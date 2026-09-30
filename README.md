# GiftCasamento

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
Cobre as regras do `AuthService`: e-mail duplicado, senha nunca salva em
texto puro, senha errada e e-mail inexistente no login, e login
bem-sucedido retornando token.

## Segurança já implementada
- Senhas salvas com hash (`bcryptjs`), nunca em texto puro.
- Login retorna sempre "E-mail ou senha inválidos", sem revelar se o
  e-mail existe.
- Sessão via JWT (7 dias), guardado num cookie **httpOnly** setado pelo
  próprio servidor Next (não `localStorage`) — o JavaScript do navegador
  nunca tem acesso ao token.
- CORS restrito à URL configurada em `FRONTEND_URL`.
- Rate limit de 5 tentativas por minuto por IP no `/auth/login`, contra
  força bruta.
- Middleware no Next barrando o acesso a rotas autenticadas (hoje só
  `/dashboard`) antes mesmo da página carregar, caso não haja o cookie.

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
- [ ] Rota protegida redirecionando quem não está logado *(implementado — falta aplicar e testar em produção)*
- [x] Front, back e banco todos hospedados e se comunicando

## Próximos passos (Sprint 2 / v1 do MVP)
Modelar `Event` e `Gift` no Prisma, criar o CRUD de eventos (slug + senha
de convidado) e o formulário de cadastro de presentes com auto-fetch de
metadados, conforme o planejamento do MVP.
