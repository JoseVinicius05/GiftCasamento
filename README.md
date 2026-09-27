# GiftCasamento

Sistema de lista de presentes de casamento. Ver `CLAUDE.md` para o
contexto completo do produto e as regras de negócio, e `CONTRIBUTING.md`
para as convenções do time.

## Estrutura (monorepo)
```
apps/frontend/  -> Next.js — já existia, mantido como estava
apps/backend/   -> Nest.js + Prisma — novo
docker-compose.yml -> Postgres local
```

## Pré-requisitos
- Node.js 20+
- Docker (pra rodar o Postgres local)

## Setup

### 1. Subir o Postgres local
```bash
docker compose up -d
```
Sobe um Postgres em `localhost:5432` (user/senha/db:
`gift_list` / `gift_list` / `gift_casamento_dev`).

### 2. Backend (Nest.js + Prisma)
```bash
cd apps/backend
cp .env.example .env
npm install
npx prisma generate
npm run start:dev
```
Testar em `http://localhost:3001/health` — deve responder `{"status":"ok"}`.

### 3. Frontend (Next.js)
```bash
cd apps/frontend
npm install
npm run dev
```
Abrir `http://localhost:3000`.

> Front e back rodam de forma independente por enquanto — a integração
> real (cadastro/login chamando a API) é o próximo passo do planejamento.

## Deploy (planejado)
- Frontend → Vercel
- Backend → Railway ou Render
- Postgres → Neon ou Supabase

## Próximos passos
Modelar `User` no Prisma, criar `POST /auth/register` e `POST /auth/login`
no backend, e conectar as telas `apps/frontend/app/cadastro` e
`apps/frontend/app/login`, que já existem visualmente, à API real.
