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
Cobrindo:
- `AuthService`: e-mail duplicado, senha nunca salva em texto puro, senha
  errada e e-mail inexistente no login, login bem-sucedido retornando token.
- `EventsService`: geração de slug único (com retry em colisão), checagem
  de ownership em `findBySlugForOwner`/`update`, e `verifyGuestAccess`
  (senha certa, errada, slug inexistente).
- `CreateEventDto`: validação de data não-passada.
- `MercadoLivreService` / `MercadoLivreTokenService` (Sprint 3, Dia 3): parser
  de URL (productId × itemId, `wid` depois do `#`), catálogo sem preço, retry
  único em 401, `invalid_grant` sem derrubar o cadastro, refresh concorrente
  disparando uma única renovação. **Nunca batem na API real** — `fetch` é mockado.
- `MetadataService` / `detectStore`: loja não suportada (422
  `UNSUPPORTED_ECOMMERCE`), campos faltando, domínios parecidos não enganam.

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

## Módulo de presentes — preview de metadados (Sprint 3, Dia 3)

| Rota | Método | Protegida? | O que faz |
|---|---|---|---|
| `/events/:slug/gifts/preview` | POST | Dono (JWT) + rate limit (15/min por IP) | Recebe `{ "url": "..." }`, identifica a loja e devolve título/imagem/preço **sem salvar nada** |

**Lojas com auto-fetch:** Mercado Livre e Amazon. Qualquer outra loja devolve
`422` com `{ "code": "UNSUPPORTED_ECOMMERCE" }` e o formulário cai pro modo manual.

**Resposta de sucesso (200):** o `ProductMetadata` normalizado + `store` +
`missingFields` (lista do que o dono vai ter que preencher na mão). Campo
faltando **não é erro** — é o caso normal.

**Como cada loja funciona:**

- **Mercado Livre** — API oficial, endpoint de **catálogo** (`GET /products/{id}`),
  com o token OAuth da conta de integração.
  - `GET /items/{id}` devolve `403 access_denied` para anúncios de outros
    vendedores, mesmo com token válido (testado de verdade). Por isso o
    catálogo é o caminho principal, e `/items` só é tentado em URLs clássicas
    de anúncio (`/MLB-123-titulo_JM`), onde provavelmente vai falhar e o dono
    preenche manualmente.
  - **O preço do Mercado Livre não vem**: `buy_box_winner` é `null` nos
    produtos testados. O dono sempre digita o preço (`priceSource: 'manual'`).
  - **Não há fallback Microlink pro ML**: ele só devolve o título/logo
    genéricos do site ("Mercado Livre"), pior que campo vazio.
  - O `wid` (id do anúncio) nos links de recomendação vem **depois do `#`** —
    o parser (`mercado-livre-url.ts`) lê os dois lugares.
  - Token expirado → renova sozinho; 401 → renova e repete **uma** vez;
    `invalid_grant` / ML não conectado → o preview segue com campos vazios
    (modo manual) e o log pede pra refazer `GET /auth/mercadolivre/connect`.
- **Amazon** — Bright Data (principal) + Microlink (fallback técnico).
- Links encurtados (`amzn.to`, `meli.la`) **não** são reconhecidos: o dono precisa
  colar o link completo do produto.

Variáveis de ambiente (nenhuma nova neste dia): `MERCADOLIVRE_CLIENT_ID`,
`MERCADOLIVRE_CLIENT_SECRET`, `MERCADOLIVRE_REDIRECT_URI`,
`MERCADOLIVRE_SETUP_KEY`, `BRIGHTDATA_API_KEY`, `MICROLINK_API_KEY`.

Testes manuais prontos em `apps/backend/http/gifts.http`. Para testar o ML
pela linha de comando (fora do Nest), existe também
`apps/backend/test-product-metadata.mjs` — com `MERCADOLIVRE_ACCESS_TOKEN` no
ambiente, ele mostra qual ID foi extraído e o que cada endpoint respondeu.

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

## Próximos passos (Sprint 3 — Dia 4)
- `POST /events/:slug/gifts` (salva os valores confirmados; `priceSource`
  `auto`/`manual` — para o Mercado Livre sempre `manual`), `GET` e `PATCH` do
  presente, com o mesmo ownership check (404) dos eventos.
- Lista de presentes no painel e o botão "Salvar presente" no `AddGiftForm`
  (hoje o formulário só faz o preview).
- Testar com URLs reais de Mercado Livre e Amazon, incluindo produto sem preço.
