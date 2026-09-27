# Convenções do projeto

## Estrutura
Monorepo com npm workspaces — decisão documentada no planejamento do MVP,
pra reduzir overhead de coordenação num time de 4 pessoas aprendendo a
stack em paralelo.
```
apps/
  frontend/  -> Next.js (já existente, mantido como está)
  backend/   -> Nest.js + Prisma (novo)
```

## ORM
**Prisma** — confirmado no `CLAUDE.md` e no planejamento do MVP.

## Linter / Formatação
- Cada app mantém seu próprio ESLint (`apps/frontend/eslint.config.mjs` e
  `apps/backend/.eslintrc.json`), já que usam bases diferentes (Next vs Nest).
- Rodar `npm run lint` na raiz roda os dois.

## Padrão de commits
Conventional Commits:
```
feat: adiciona endpoint de registro de usuário
fix: corrige validação de senha no login
chore: configura docker-compose do postgres
docs: atualiza README com passo a passo do backend
refactor: extrai lógica de hash de senha pro AuthService
test: adiciona testes unitários do AuthService
```

## Branches
`feat/nome-curto`, `fix/nome-curto`, a partir de `main`. PR com pelo menos
1 revisão cruzada (Dupla A revisa Dupla B e vice-versa).

## Regras de negócio críticas (ver CLAUDE.md para o contexto completo)
- Sistema nunca processa/custodia dinheiro.
- Transição `available → claimed` de um Gift precisa ser atômica no banco.
- Nenhum fluxo de pagamento além do descrito no CLAUDE.md sem alinhar antes.
