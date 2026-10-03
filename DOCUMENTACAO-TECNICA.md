# Documentação Técnica — WebGift

Este documento explica, em detalhe, o que cada arquivo do backend e do
frontend faz e como eles se conectam entre si. A ideia é que qualquer
pessoa do time consiga ler isso e entender o sistema inteiro sem precisar
adivinhar nada olhando o código sozinho.

Cobre o que foi implementado nos Dias 1 a 4 da Sprint 1: cadastro, login,
sessão via JWT, rota protegida e as camadas de segurança (rate limit,
cookie httpOnly, middleware).

---

## 1. Visão geral da arquitetura

```
┌─────────────┐       ┌──────────────────────┐       ┌──────────────────┐
│  Navegador  │──────▶│  Frontend (Next.js)  │──────▶│ Backend (Nest.js) │
│             │◀──────│      Vercel           │◀──────│      Render       │
└─────────────┘       └──────────────────────┘       └────────┬──────────┘
                                                                │ Prisma
                                                                ▼
                                                        ┌──────────────┐
                                                        │  Postgres    │
                                                        │    (Neon)    │
                                                        └──────────────┘
```

Um detalhe importante: o navegador **não fala diretamente com o backend**
quando o assunto é login. Ele fala com o próprio Next.js (que roda tanto
o frontend quanto uma pequena camada de servidor, os "Route Handlers"),
e é o Next.js que fala com o backend Nest.js. Esse padrão se chama
**BFF (Backend for Frontend)** e existe por causa da forma como o cookie
de sessão é guardado — isso é explicado com calma na seção 4.3.

Duas exceções a essa regra: o **cadastro** (`/auth/register`) e a
**leitura do usuário logado dentro do dashboard** (`/auth/me`) chamam o
backend diretamente, sem passar pelo BFF. O cadastro não lida com sessão
nenhuma, e o dashboard já roda no servidor do Next, então não tem
"navegador" no meio pra se preocupar em esconder o token dele.

---

## 2. Estrutura de pastas

```
WebGift/ (pasta do repositório; o nome ainda pode mudar, ver nota abaixo)
├── apps/
│   ├── backend/            → API em Nest.js
│   │   ├── prisma/
│   │   │   └── schema.prisma       → define as tabelas do banco
│   │   ├── src/
│   │   │   ├── main.ts              → ponto de entrada do servidor
│   │   │   ├── app.module.ts        → módulo raiz
│   │   │   ├── prisma.service.ts    → conexão com o Postgres
│   │   │   ├── prisma.module.ts     → disponibiliza o Prisma pro app todo
│   │   │   └── auth/
│   │   │       ├── auth.controller.ts   → define as rotas HTTP
│   │   │       ├── auth.service.ts      → regras de negócio (registrar/logar)
│   │   │       ├── auth.module.ts       → junta controller + service + JWT + rate limit
│   │   │       ├── jwt-auth.guard.ts    → "segurança de porta" das rotas protegidas
│   │   │       ├── auth.service.spec.ts → testes automatizados
│   │   │       └── dto/
│   │   │           ├── register.dto.ts  → valida os dados do cadastro
│   │   │           └── login.dto.ts     → valida os dados do login
│   │   └── http/
│   │       └── auth.http            → coleção de requisições de teste manual
│   │
│   └── frontend/           → Site em Next.js
│       ├── middleware.ts            → bloqueia rotas protegidas sem login
│       ├── lib/
│       │   └── auth-cookie.ts       → nome do cookie de sessão (compartilhado)
│       └── app/
│           ├── cadastro/page.tsx    → tela de criar conta
│           ├── login/page.tsx       → tela de entrar
│           ├── dashboard/
│           │   ├── page.tsx         → página "logada", prova que tudo funciona
│           │   └── LogoutButton.tsx → botão de sair
│           └── api/
│               ├── login/route.ts   → recebe o login e cria o cookie
│               └── logout/route.ts  → apaga o cookie
│
└── docker-compose.yml      → sobe um Postgres local pra desenvolvimento
```

---

## 3. Backend (`apps/backend`)

### 3.1. `prisma/schema.prisma` — o desenho do banco de dados

```prisma
model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("users")
}
```

Isso descreve a tabela `users` (o `@@map` traduz o nome do modelo em
TypeScript, `User`, pro nome real da tabela no Postgres, `users` — mesma
ideia por trás do `@map("password_hash")` em cada campo: no código você
escreve `passwordHash` em camelCase, no banco a coluna se chama
`password_hash` em snake_case, que é a convenção usual de SQL).

- `id`: um UUID gerado automaticamente, não um número sequencial — evita
  que alguém adivinhe quantos usuários existem ou tente `/users/2`,
  `/users/3` pra "passear" pelos registros.
- `email`: marcado `@unique`, o que faz o próprio Postgres rejeitar duas
  linhas com o mesmo e-mail, mesmo que o código tente inserir ambas ao
  mesmo tempo (isso é usado no `auth.service.ts`, explicado adiante).
- `passwordHash`: nunca guarda a senha em si, só o resultado de passá-la
  pelo bcrypt (seção 3.4).

Toda vez que esse arquivo muda, é preciso rodar
`npx prisma migrate dev --name algum-nome` pra gerar o SQL que aplica a
mudança no banco (isso cria uma pasta em `prisma/migrations`) e rodar
`npx prisma generate` pra atualizar o "PrismaClient" — o código
TypeScript com o qual o resto do backend consulta o banco.

### 3.2. `src/main.ts` — o ponto de entrada

É o primeiro arquivo que roda quando você faz `npm run start:dev`.
Ele faz, nesta ordem:

1. **Carrega o `.env`** (`import 'dotenv/config'`). Isso precisa ser a
   primeiríssima linha do arquivo — antes até dos outros `import` —
   porque os módulos seguintes (como o `AuthModule`, que lê
   `process.env.JWT_SECRET` assim que é carregado) precisam que as
   variáveis já estejam disponíveis.
2. **Confere se `JWT_SECRET` existe.** Se não existir, imprime um erro
   claro e desliga o processo (`process.exit(1)`) em vez de deixar o
   servidor subir "quebrado" e só falhar depois, na hora do primeiro
   login — é melhor descobrir o problema no boot do que em produção.
3. **Cria a aplicação Nest** a partir do `AppModule`.
4. **Liga a validação automática de DTOs** (`ValidationPipe`) — é isso
   que faz o backend rejeitar sozinho, com uma mensagem clara, um
   cadastro sem e-mail ou com senha curta, antes mesmo de chegar no
   `AuthService`. A opção `whitelist: true` descarta qualquer campo
   enviado que não esteja definido no DTO (proteção extra contra alguém
   mandar campos a mais tentando manipular o que é salvo).
5. **Liga o CORS**, liberando só a origem definida em `FRONTEND_URL` —
   sem isso, o navegador bloqueia qualquer chamada vinda de um domínio
   diferente (é a mesma trava que gerou o erro de CORS que você teve na
   Vercel). `credentials: true` é necessário porque o navegador manda
   cookies nas requisições.
6. **Sobe o servidor** na porta definida em `PORT`, escutando em
   `0.0.0.0` — isso é exigência de plataformas como Render/Railway, que
   não conseguem rotear tráfego pro serviço se ele escutar só em
   `localhost`.

### 3.3. `src/app.module.ts` — o módulo raiz

```ts
@Module({
  imports: [PrismaModule, AuthModule],
  ...
})
```

O Nest organiza o código em "módulos". Este é o módulo principal, que só
importa os outros dois: `PrismaModule` (acesso ao banco) e `AuthModule`
(cadastro/login). Quando o sistema crescer (Dia 2+ da Sprint 2, com
eventos e presentes), novos módulos como `EventModule` e `GiftModule`
entram aqui.

### 3.4. `src/prisma.service.ts` e `src/prisma.module.ts` — a conexão com o banco

O `PrismaService` é uma classe fininha que estende o `PrismaClient`
gerado pelo Prisma e garante que a conexão com o Postgres abre quando o
Nest inicia (`onModuleInit`) e fecha quando o Nest desliga
(`onModuleDestroy`) — sem isso, cada parte do código teria que abrir e
fechar sua própria conexão manualmente.

O `PrismaModule` só existe pra registrar esse serviço e marcá-lo como
`@Global()` — ou seja, qualquer outro módulo do backend (como o
`AuthModule` hoje, e `EventModule`/`GiftModule` no futuro) pode "injetar"
o `PrismaService` no construtor sem precisar importar o `PrismaModule`
de novo em cada lugar.

### 3.5. `src/auth/dto/register.dto.ts` e `login.dto.ts` — validação de entrada

Um DTO ("Data Transfer Object") descreve o formato esperado do corpo de
uma requisição, com decorators do `class-validator` que o
`ValidationPipe` (visto em 3.2) confere automaticamente antes mesmo do
código chegar no `AuthController`.

No `register.dto.ts`:
- `name`: texto, obrigatório, até 100 caracteres, e passa por um
  `@Transform` que remove espaços em branco no início/fim.
- `email`: precisa ser um e-mail válido, e é convertido pra minúsculas
  antes de qualquer outra coisa — assim `Ana@X.com` e `ana@x.com` são
  tratados como o mesmo endereço, tanto pra evitar cadastro duplicado
  quanto pra login funcionar independente de como a pessoa digitou.
- `password`: entre 8 e 72 caracteres. O limite de 72 não é arbitrário:
  é uma limitação real do algoritmo bcrypt, que ignora silenciosamente
  qualquer caractere além do 72º — melhor rejeitar antes do que deixar
  a pessoa pensar que sua senha inteira foi usada quando não foi.

O `login.dto.ts` é mais simples: só exige um e-mail válido e alguma
senha não vazia — a validação "essa senha está certa?" não é papel do
DTO, é papel do `AuthService` (seção 3.6), porque envolve consultar o
banco.

### 3.6. `src/auth/auth.service.ts` — as regras de negócio

Esse é o coração do módulo de autenticação. Duas responsabilidades:

**`register(dto)`**
1. Procura no banco se já existe um usuário com aquele e-mail. Se
   existir, lança `ConflictException` (HTTP 409).
2. Gera o hash da senha com `bcrypt.hash(dto.password, 10)` — o `10` é o
   "custo" do hash: quanto maior, mais lento (de propósito) fica pra
   calcular, o que dificulta ataques de força bruta caso o banco
   vazasse um dia. `10` é um valor padrão equilibrado entre segurança e
   velocidade de resposta.
3. Salva o usuário no banco, mas o `select` na consulta garante que a
   resposta devolvida pro frontend tem só `id`, `name`, `email` e
   `createdAt` — o hash da senha nunca sai do banco pra fora.
4. Existe um `try/catch` em volta do `create`: é uma proteção contra uma
   condição de corrida. Imagine duas pessoas mandando cadastro com o
   mesmo e-mail no exato mesmo milissegundo — os dois passariam pela
   checagem do passo 1 (porque nenhum dos dois ainda existia no banco
   naquele instante), e só o índice `@unique` do Postgres consegue
   travar a segunda tentativa. O código captura esse erro específico do
   Prisma (código `P2002`, "violação de restrição única") e o
   transforma no mesmo erro amigável 409, em vez de deixar vazar um erro
   feio de banco de dados pro usuário.

**`login(dto)`**
1. Busca o usuário pelo e-mail.
2. Compara a senha enviada com o hash salvo, usando
   `bcrypt.compare(senhaDigitada, hashSalvo)`.
3. Aqui tem um detalhe de segurança sutil: se o usuário **não existir**,
   o código ainda assim roda um `bcrypt.compare` contra um hash "de
   mentira" (a constante `DUMMY_HASH`), em vez de simplesmente retornar
   o erro na hora. Por quê? Porque `bcrypt.compare` é uma operação
   propositalmente lenta (por causa do custo visto acima). Se o código
   retornasse instantaneamente quando o e-mail não existe, e demorasse
   um pouquinho mais quando o e-mail existe mas a senha está errada,
   alguém poderia **medir esse tempo de resposta** e descobrir quais
   e-mails estão cadastrados no sistema, mesmo sem nunca ver a
   mensagem de erro. Rodando o `compare` sempre, os dois casos demoram
   o mesmo tempo.
4. Se o usuário não existir OU a senha estiver errada, o erro devolvido
   é **sempre o mesmo**: `"E-mail ou senha inválidos"` — de novo, pra
   não revelar qual dos dois motivos foi.
5. Se tudo bater, gera um JWT (JSON Web Token) assinado com a
   `JWT_SECRET`, contendo só o `id` do usuário no campo `sub` ("subject",
   convenção padrão de JWT). Esse token expira em 7 dias
   (configurado no `auth.module.ts`, seção 3.8). Retorna o token junto
   com os dados públicos do usuário.

**`validateUserById(userId)`**
Usada pela rota `/auth/me` (seção 3.7): busca o usuário pelo `id` que
veio de dentro do token (não de um parâmetro que o cliente poderia
manipular) e devolve os dados públicos.

### 3.7. `src/auth/jwt-auth.guard.ts` — o "segurança da porta"

Um "Guard" no Nest é uma peça que roda **antes** do controller, decidindo
se a requisição pode continuar ou deve ser barrada. Este guard:

1. Olha o header `Authorization` da requisição, esperando o formato
   `Bearer <token>`.
2. Se não tiver header nenhum, barra com `401 - Token ausente`.
3. Se tiver, tenta validar o token com `jwtService.verifyAsync` — isso
   confere tanto a assinatura (prova que o token foi gerado por este
   backend, com esta `JWT_SECRET`, e não forjado por outra pessoa)
   quanto a validade (o token não pode estar expirado).
4. Se a verificação passar, pega o `sub` (o id do usuário) de dentro do
   token e guarda em `request.userId` — é assim que o controller
   (seção 3.8) sabe *quem* está fazendo a requisição, sem precisar
   confiar em nada que o cliente mandou diretamente.
5. Se falhar (assinatura inválida, token expirado, token corrompido),
   barra com `401 - Token inválido ou expirado`.

Um ponto de design importante, comentado no próprio arquivo: o token vem
do **header**, não de um cookie. Isso é proposital — como o frontend
(Vercel) e o backend (Render) ficam em domínios diferentes, um cookie
setado pelo backend não seria enviado automaticamente pelo navegador nas
chamadas para domínios diferentes (isso é uma trava de segurança dos
navegadores). Por isso o cookie httpOnly fica só no domínio do frontend
(seção 4.3), e é o próprio servidor do Next quem repassa o token pro
backend via header quando precisa.

### 3.8. `src/auth/auth.controller.ts` — as rotas HTTP

Define três rotas, todas sob o prefixo `/auth`:

| Rota | Método | Protegida? | O que faz |
|---|---|---|---|
| `/auth/register` | POST | Não | Chama `authService.register()` |
| `/auth/login` | POST | Rate limit (não login) | Chama `authService.login()` |
| `/auth/me` | GET | Sim (`JwtAuthGuard`) | Chama `authService.validateUserById()` |

O `@UseGuards(ThrottlerGuard)` na rota de login ativa o rate limit
configurado no módulo (seção 3.9): a partir da 6ª tentativa em 60
segundos vindas do mesmo IP, o Nest responde `429 Too Many Requests`
automaticamente, sem nem chegar a rodar o código do `AuthService`.

O `@UseGuards(JwtAuthGuard)` na rota `/me` é o que ativa o guard descrito
na seção 3.7.

### 3.9. `src/auth/auth.module.ts` — juntando as peças

```ts
imports: [
  JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d' } }),
  ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
],
providers: [AuthService, JwtAuthGuard],
```

- `JwtModule.register(...)` configura, pra todo o módulo, qual chave
  usar pra assinar/verificar tokens e por quanto tempo eles valem. É
  esse registro que permite ao `AuthService` e ao `JwtAuthGuard`
  "injetarem" o `JwtService` no construtor deles sem precisar configurar
  nada de novo.
- `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])` configura o
  limite geral de 5 requisições por 60000ms (1 minuto) por IP — mas
  **só entra em ação onde o `ThrottlerGuard` é explicitamente aplicado**
  (no caso, só no login, como visto na seção 3.8). Rotas sem esse guard
  não são afetadas.
- `providers: [AuthService, JwtAuthGuard]` registra essas duas classes
  no "container de injeção de dependência" do Nest, permitindo que o
  `AuthController` e outras partes do módulo as usem.

### 3.10. `src/auth/auth.service.spec.ts` — os testes automatizados

Usa Jest pra testar o `AuthService` isoladamente, sem precisar de um
banco de dados real: em vez do `PrismaService` de verdade, o teste cria
um objeto "fake" (`jest.fn()`) cujo comportamento é definido em cada
teste (`mockResolvedValue`, `mockImplementation`). O mesmo vale pro
`JwtService`.

Os 4 testes cobrem:
1. `register` rejeita e-mail já cadastrado.
2. `register` nunca salva a senha em texto puro (confere, com
   `bcrypt.compare`, que o que foi salvo bate com a senha original só
   depois de passar pelo hash).
3. `login` rejeita senha errada.
4. `login` rejeita e-mail inexistente (com o mesmo tipo de erro da senha
   errada, confirmando que a mensagem genérica funciona).
5. `login` bem-sucedido retorna o token (vindo do mock) e os dados
   certos do usuário.

Rodar com `npm test` dentro de `apps/backend`.

---

## 4. Frontend (`apps/frontend`)

### 4.1. `app/cadastro/page.tsx` — tela de criar conta

É um **Client Component** (`'use client'` no topo — isso é necessário
porque a página usa `useState` e responde a eventos do usuário, coisas
que só existem no navegador, não durante a renderização no servidor).

Guarda `name`, `email`, `password`, `confirmPassword` e `acceptedTerms`
em estado local. No `onSubmit`:
1. Confere no próprio navegador se as duas senhas digitadas batem, e se
   os termos foram aceitos — evita uma ida desnecessária ao servidor
   pra um erro que dá pra pegar na hora.
2. Chama `fetch` **diretamente pro backend**
   (`${NEXT_PUBLIC_API_URL}/auth/register`) — diferente do login, o
   cadastro não lida com sessão, então não precisa passar pelo Route
   Handler do Next.
3. Se a resposta não for OK, mostra a mensagem de erro que veio do
   backend (por exemplo, "Este e-mail já está cadastrado") num quadro
   vermelho, sem sair da página.
4. Se der certo, redireciona pra `/login` com `router.push`.

### 4.2. `app/login/page.tsx` — tela de entrar

Estrutura parecida com a de cadastro, mas o `fetch` é feito pra
`/api/login` — uma rota **do próprio Next**, não do backend. Isso é
intencional, e é explicado na próxima seção. Se der certo, redireciona
pra `/dashboard`.

### 4.3. `app/api/login/route.ts` — o Route Handler que cria a sessão

Esse é o arquivo mais importante pra entender *como* a sessão funciona,
então vale a pena ler com calma.

Um "Route Handler" no Next é uma rota de API que roda **no servidor**,
dentro do próprio processo do Next (na Vercel, isso vira uma função
serverless). Quando o formulário de login (seção 4.2) chama
`fetch('/api/login', ...)`, essa chamada nunca sai do domínio da Vercel.

O que a rota faz:
1. Recebe `{ email, password }` do formulário.
2. Chama o **backend de verdade**
   (`${NEXT_PUBLIC_API_URL}/auth/login`) — aqui sim, servidor
   conversando com servidor.
3. Se o backend recusar (senha errada, etc.), repassa a mesma resposta
   de erro pro navegador.
4. Se der certo, o backend devolveu `{ accessToken, user }`. A rota
   então:
   - Devolve pro navegador só `{ user }` — **o token nunca é enviado
     pro JavaScript da página**.
   - Guarda o `accessToken` num **cookie httpOnly**
     (`response.cookies.set(...)`), com essas configurações:
     - `httpOnly: true` — o JavaScript rodando no navegador (inclusive
       um script malicioso injetado por um ataque de XSS) **não
       consegue ler esse cookie**. Só o próprio servidor do Next
       consegue.
     - `secure: true` em produção — o cookie só é enviado em conexões
       HTTPS.
     - `sameSite: 'lax'` — o cookie não é enviado em requisições
       vindas de outros sites, uma proteção extra contra CSRF.
     - `maxAge` de 7 dias — o mesmo prazo de validade do JWT em si.

Essa é a razão de existir do padrão BFF mencionado na seção 1: guardar o
token diretamente no `localStorage` (uma alternativa mais simples) seria
acessível por qualquer script rodando na página, incluindo um script
malicioso injetado por uma falha de XSS em qualquer lugar do site. Um
cookie httpOnly elimina essa porta de entrada inteira.

### 4.4. `app/api/logout/route.ts` — encerrando a sessão

Bem mais simples: só chama `response.cookies.delete(TOKEN_COOKIE)`,
apagando o cookie do navegador. Não precisa avisar o backend, porque o
JWT não fica guardado no banco (ele é "stateless" — a própria assinatura
já prova sua validade); apagar o cookie é suficiente pra "esquecer" a
sessão do lado do navegador.

### 4.5. `lib/auth-cookie.ts` — evitando repetição

Só exporta uma constante, `TOKEN_COOKIE = 'gift_casamento_token'`. Sem
esse arquivo, o nome do cookie estaria digitado igual em 4 lugares
diferentes (login, logout, dashboard, middleware) — bastaria alguém
digitar errado em um deles pra sessão parar de funcionar silenciosamente.
Centralizar isso num arquivo garante que todos os lugares concordam.

### 4.6. `app/dashboard/page.tsx` — a prova de que tudo funciona

Este é um **Server Component** (repare que não tem `'use client'` — ele
roda inteiramente no servidor do Next, nunca no navegador). Ele:

1. Lê o cookie da requisição com `cookies()` (API do Next). Se não
   existir, redireciona pra `/login` na hora.
2. Se existir, chama `GET /auth/me` no backend, **mandando o token no
   header** `Authorization: Bearer <token>` — é aqui que o servidor do
   Next "repassa" o token que estava guardado no cookie httpOnly pro
   backend, fazendo a ponte entre os dois mundos (cookie no frontend,
   header no backend) mencionada na seção 3.7.
3. Se o backend recusar o token (expirado, por exemplo), redireciona pra
   `/login` também.
4. Se der tudo certo, mostra o nome e e-mail do usuário.

Vale reforçar o que já está comentado no próprio arquivo: esta página
existe pra **testar** o fluxo completo (cadastro → login → sessão →
rota protegida), não é a tela final do produto. Conforme a Sprint 2
avançar (painel de eventos, lista de presentes), esse tipo de checagem
provavelmente vira um "layout" reutilizável em vez de código repetido em
cada página.

### 4.7. `app/dashboard/LogoutButton.tsx` — o botão de sair

Um pequeno Client Component separado do `page.tsx` porque **precisa**
ser client (responde a clique), enquanto o resto do dashboard não
precisa. Ao clicar, chama `POST /api/logout` (seção 4.4) e redireciona
pro login. O `router.refresh()` depois do `push` garante que, se o
usuário apertar "voltar" no navegador, o Next não mostre uma versão do
dashboard guardada em cache antes do cookie ser apagado.

### 4.8. `middleware.ts` — o segurança na porta de entrada do site

Diferente dos Route Handlers, um middleware no Next roda **antes** de
qualquer página ser processada, pra qualquer requisição que bata com o
`matcher` configurado no fim do arquivo (hoje, só `/dashboard/:path*`).

A lógica é simples: se a rota pedida está na lista `PROTECTED_PATHS` e
não existe o cookie de sessão, redireciona pro `/login` imediatamente —
sem nem chegar a carregar o componente da página.

**Um ponto importante de design:** o middleware confere só se o cookie
**existe**, não se o token dentro dele é válido (não expirou, assinatura
correta). Isso é proposital: validar o JWT exigiria rodar a mesma lógica
de verificação que está no `JwtAuthGuard` do backend, mas o middleware
roda num ambiente restrito ("Edge Runtime"), e duplicar essa lógica ali
criaria duas fontes de verdade pra manter sincronizadas. Por isso a
validação "de verdade" continua acontecendo no `dashboard/page.tsx`
(seção 4.6), que chama `/auth/me` de fato. O middleware é uma primeira
barreira rápida (evita carregar a página à toa pra quem obviamente nunca
logou), e o `dashboard/page.tsx` é quem garante a segurança de verdade.
Pense nele como o segurança que confere se você tem uma entrada na mão
— quem confere se a entrada não é falsificada é a catraca lá dentro.

Conforme novas páginas autenticadas forem criadas, basta adicionar o
prefixo delas no array `PROTECTED_PATHS` e no `matcher`.

---

## 5. Fluxos completos, do clique ao banco

### 5.1. Cadastro

1. Usuário preenche o formulário em `/cadastro` e clica em "Criar minha
   conta".
2. O navegador chama `POST https://SEU-BACKEND.onrender.com/auth/register`
   diretamente.
3. O Nest recebe, o `ValidationPipe` confere o formato dos dados contra
   o `RegisterDto`. Se algo estiver errado (e-mail inválido, senha
   curta), responde `400` com as mensagens de validação — sem nem
   chegar no `AuthController`.
4. Se os dados passarem, o `AuthController.register()` chama
   `AuthService.register()`.
5. O `AuthService` consulta o Postgres via Prisma pra ver se o e-mail já
   existe. Se existir, `409`.
6. Se não existir, gera o hash da senha com bcrypt e salva o usuário no
   banco (tabela `users` no Neon/Postgres).
7. Responde `201` com os dados públicos do usuário.
8. O frontend recebe a resposta de sucesso e redireciona pra `/login`.

### 5.2. Login

1. Usuário preenche `/login` e clica em "Entrar".
2. O navegador chama `POST /api/login` — **dentro do próprio domínio da
   Vercel**, sem tocar o backend ainda.
3. O Route Handler (`app/api/login/route.ts`), rodando no servidor do
   Next, chama `POST https://SEU-BACKEND.onrender.com/auth/login`.
4. O `ThrottlerGuard` do Nest confere se esse IP não estourou o limite
   de 5 tentativas/minuto. Se estourou, `429`.
5. Se não estourou, o `AuthController.login()` chama
   `AuthService.login()`, que busca o usuário, compara a senha com
   bcrypt, e — se tudo bater — assina um JWT válido por 7 dias.
6. O backend responde `200` com `{ accessToken, user }`.
7. O Route Handler do Next recebe essa resposta, guarda o `accessToken`
   num cookie httpOnly no domínio da Vercel, e devolve pro navegador só
   `{ user }`.
8. O navegador redireciona pra `/dashboard`.

### 5.3. Acessando o dashboard (usuário já logado)

1. O navegador pede `/dashboard`.
2. **Antes de qualquer página carregar**, o `middleware.ts` confere se
   existe o cookie de sessão. Existe (acabou de logar) → deixa passar.
3. O `dashboard/page.tsx` roda no servidor do Next, lê o valor do cookie,
   e chama `GET https://SEU-BACKEND.onrender.com/auth/me` mandando o
   token no header `Authorization`.
4. O `JwtAuthGuard` do Nest verifica a assinatura e a validade do token.
   Válido → deixa passar, e guarda o `id` do usuário na requisição.
5. O `AuthController.me()` chama `AuthService.validateUserById()`, que
   busca o usuário no banco pelo `id` (vindo do token, não de nada que o
   cliente possa manipular).
6. O backend responde `200` com nome e e-mail.
7. O Next renderiza a página já com esses dados, e manda o HTML pronto
   pro navegador.

### 5.4. Tentando acessar o dashboard sem estar logado

1. O navegador pede `/dashboard`.
2. O `middleware.ts` confere o cookie. Não existe → redireciona
   direto pra `/login?redirectTo=/dashboard`, sem nem tentar carregar a
   página do dashboard.

### 5.5. Logout

1. Usuário clica em "Sair" no dashboard.
2. O `LogoutButton` chama `POST /api/logout`.
3. O Route Handler apaga o cookie da resposta.
4. O navegador redireciona pra `/login`.
5. Se o usuário tentar voltar pro `/dashboard` depois disso, cai de novo
   no fluxo da seção 5.4 — o cookie não existe mais.

---

## 6. Resumo das decisões de segurança e o porquê de cada uma

| Decisão | Por quê |
|---|---|
| Senha nunca salva em texto puro, só o hash bcrypt | Se o banco vazar um dia, ninguém recupera a senha original |
| Custo do bcrypt = 10 | Torna o cálculo do hash lento o bastante pra dificultar força bruta, sem deixar o login perceptivelmente lento pro usuário |
| Erro de login sempre genérico ("E-mail ou senha inválidos") | Não revela se um e-mail específico está cadastrado no sistema |
| `bcrypt.compare` roda mesmo com e-mail inexistente (hash "de mentira") | Fecha a mesma brecha acima, mas por tempo de resposta em vez de mensagem |
| Token JWT, não sessão guardada no banco | Simplifica o backend (não precisa de tabela de sessões nem de limpeza de sessões expiradas) |
| Token expira em 7 dias | Limita o estrago se um token vazar |
| Token no header `Authorization`, não em cookie, no backend | Cookies não atravessam domínios diferentes (Vercel ↔ Render) automaticamente |
| Cookie httpOnly no frontend, não `localStorage` | JavaScript malicioso (XSS) não consegue ler um cookie httpOnly |
| `sameSite: 'lax'` no cookie | Proteção adicional contra CSRF |
| CORS restrito a `FRONTEND_URL` | Nenhum outro site consegue chamar o backend diretamente do navegador de um usuário |
| Rate limit de 5/min no login | Dificulta ataques de força bruta testando senhas em sequência |
| Validação de DTO com `whitelist: true` | Ignora qualquer campo extra que alguém tente mandar no corpo da requisição |
| `JWT_SECRET` obrigatória pra subir o servidor | Evita rodar em produção (ou até em dev) com uma chave vazia ou previsível |

---

## 7. O que ainda não existe (fora do escopo até aqui)

Pra deixar claro o que **não** foi implementado ainda, e evitar
confusão:

- Recuperação de senha ("esqueci minha senha").
- Confirmação de e-mail no cadastro.
- Refresh token (hoje, quando o JWT de 7 dias expira, a única saída é
  logar de novo).
- Qualquer coisa relacionada a eventos, presentes ou convidados — isso é
  o escopo da Sprint 2, ainda não começou.
- Testes automatizados do frontend (só o backend tem testes até agora).
