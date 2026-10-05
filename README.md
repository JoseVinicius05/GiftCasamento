# WebGift

Sistema de lista de presentes de casamento. Ver `CLAUDE.md` para o
contexto completo do produto e as regras de negócio, `CONTRIBUTING.md`
para as convenções do time, e `DOCUMENTACAO-TECNICA.md` para uma
explicação detalhada de como cada parte do código funciona.

## Estrutura (monorepo)
```
apps/frontend/  -> Next.js (App Router)
apps/backend/   -> Nest.js + Prisma
docker-compose.yml -> Postgres local
```

## Pré-requisitos
- Node.js 20+
- Docker Desktop (pra rodar o Postgres local)

## Setup local

### 1. Subir o Postgres local
```bash
docker compose up -d
```
Sobe um Postgres em `localhost:5432` (user/senha/db:
`gift_list` / `gift_list` / `gift_casamento_dev`).

> Se a porta 5432 já estiver ocupada por outro Postgres instalado na sua
> máquina, troque `"5432:5432"` por `"5433:5432"` no `docker-compose.yml`
> e ajuste a porta na `DATABASE_URL` do `.env` do backend.

### 2. Backend (Nest.js + Prisma)
```bash
cd apps/backend
cp .env.example .env
```
Abra o `.env` recém-criado e gere sua própria `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Cole o valor gerado na linha `JWT_SECRET=` do `.env`. Sem isso o backend
recusa iniciar (é proposital, ver `DOCUMENTACAO-TECNICA.md`).

```bash
npm install
npx prisma migrate dev
npm run start:dev
```
Testar em `http://localhost:3001/health` — deve responder `{"status":"ok"}`.

### 3. Frontend (Next.js)
```bash
cd apps/frontend
cp .env.example .env
npm install
npm run dev
```
Abrir `http://localhost:3000`.

### 4. Testar o fluxo completo
1. Crie uma conta em `/cadastro`.
2. Faça login em `/login`.
3. Deve cair em `/dashboard`, mostrando seu nome e e-mail — essa página
   prova que cadastro → login → cookie httpOnly → rota protegida
   (`GET /auth/me`) estão funcionando de ponta a ponta.

## Rodando os testes automatizados
```bash
cd apps/backend
npm test
```
26 testes no total, cobrindo:
- `AuthService`: e-mail duplicado, senha nunca salva em texto puro, senha
  errada e e-mail inexistente no login, login bem-sucedido retornando token.
- `EventsService`: geração de slug único (com retry em colisão), checagem
  de ownership em `findBySlugForOwner`/`update`, e `verifyGuestAccess`
  (senha certa, errada, slug inexistente).
- `CreateEventDto`: validação de data não-passada.

## Módulo de eventos (Sprint 2)

| Rota | Método | Protegida? | O que faz |
|---|---|---|---|
| `/events` | POST | Dono (JWT) | Cria um evento, gera slug único e hash da senha de convidado |
| `/events` | GET | Dono (JWT) | Lista só os eventos do dono logado |
| `/events/:slug` | GET | Dono (JWT) | Dados completos de um evento — 404 se não existir ou não for seu |
| `/events/:slug` | PATCH | Dono (JWT) | Edita título, tipo, data e/ou chave Pix |
| `/events/:slug/access` | POST | Pública | Convidado confere a senha do evento (sem gerar sessão ainda — isso é Sprint 4) |

Nenhuma variável de ambiente nova foi adicionada nesta sprint — as mesmas
do Dia 1 (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`) continuam
suficientes. Toda vez que o `schema.prisma` mudar, rodar
`npx prisma migrate dev --name algum-nome` localmente antes de dar push
(o deploy no Render aplica a migration sozinho via `prisma migrate deploy`).

Testes manuais prontos em `apps/backend/http/events.http`.

## Segurança já implementada
- Senhas salvas com hash (`bcryptjs`), nunca em texto puro.
- Login retorna sempre "E-mail ou senha inválidos", sem revelar se o
  e-mail existe.
- Sessão via JWT (7 dias), guardado num cookie **httpOnly** setado pelo
  próprio servidor Next (não `localStorage`) — o JavaScript do navegador
  nunca tem acesso ao token.
- CORS restrito à URL configurada em `FRONTEND_URL`.
- Rate limit de 5 tentativas por minuto por IP no `/auth/login`, e de 10
  por minuto no `/events/:slug/access` (senha de convidado é mais curta,
  então mais fácil de tentar força bruta), contra força bruta.
- Middleware no Next barrando o acesso a rotas autenticadas (`/dashboard`,
  `/criar-casamento`, `/meus-eventos`, `/eventos`) antes mesmo da página
  carregar, caso não haja o cookie.
- `GET`/`PATCH /events/:slug` sempre retornam `404` (nunca `403`) tanto se
  o evento não existe quanto se pertence a outro dono — evita que alguém
  descubra, por tentativa e erro, quais slugs existem mas não são dele.

## Deploy

| Componente | Onde | Observações |
|---|---|---|
| Frontend | Vercel | **Root Directory = `apps/frontend`**. Variável `NEXT_PUBLIC_API_URL` precisa existir *antes* do build (ela é embutida no bundle) |
| Backend | Render | **Root Directory = `apps/backend`**. Variáveis: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (sem barra `/` no final) |
| Postgres | Neon | Região dos EUA (leste), pra ficar perto do Render — o Render não tem região no Brasil |

Depois de qualquer mudança nas variáveis de ambiente da Vercel, é preciso
fazer um **Redeploy** manual — variáveis novas não entram em vigor no
deploy que já está no ar.

## Checklist de saída da Sprint 1
- [x] Cadastro de usuário funcionando
- [x] Login retornando sessão válida (cookie httpOnly)
- [x] Rota protegida redirecionando quem não está logado
- [x] Front, back e banco todos hospedados e se comunicando

## Checklist de saída da Sprint 2
- [x] Dono autenticado cria evento com slug único e senha de convidado
- [x] ~~Modo de pagamento (link ou Pix) selecionável, com Pix key obrigatória quando aplicável~~
      **Alterado do planejamento original**: não existe mais "modo de pagamento" por
      evento. A chave Pix é **sempre obrigatória** — qualquer presente pode ser pago
      via Pix (integral ou por cota); o link da loja é um dado de cada presente
      (`Gift.product_url`, Sprint 3), não uma escolha do evento.
- [x] Dono lista e edita seus próprios eventos
- [x] Guard de ownership impede editar evento de outro dono (sempre `404`, nunca `403`)
- [x] `POST /events/:slug/access` valida a senha de convidado corretamente
- [ ] Tudo testado em produção, não só local *(testar após o deploy de hoje)*

## Próximos passos (Sprint 3)
Modelar `Gift` e `Contribution` no Prisma, integrar um serviço de metadados
(Microlink ou similar) pro auto-fetch de título/imagem/preço a partir do
link do produto, com fallback manual quando os metadados não vierem —
conforme o planejamento do MVP v2.
