@AGENTS.md

# Contexto do Projeto — Sistema de Lista de Presentes por Evento

## O que é

Sistema onde um usuário cria um evento (ex: casamento) e adiciona presentes através de links de produtos de e-commerce. O sistema tenta buscar automaticamente metadados do link (título, imagem, preço) para preencher o cadastro do presente. Convidados acessam o evento via link + senha compartilhados (sem criar conta), reivindicam presentes e seguem para a compra fora da plataforma.

**Princípio central: o sistema nunca processa/custodia dinheiro.** Isso é uma decisão deliberada para evitar compliance de pagamento (regulação do Bacen, PSD2/PCI, necessidade de CNPJ e KYC) no MVP. Qualquer sugestão de código que envolva guardar cartão, processar Pix via API, ou custodiar valores deve ser sinalizada como mudança de escopo, não implementada silenciosamente.

## Decisões de escopo do MVP (v2 — atualizado no fim da Sprint 2) — não expandir sem confirmar com o time

- ✅ **Contribuição parcial via Pix é permitida** (mudou do v1): um presente pode ser
  comprado por completo (link da loja ou Pix integral) OU financiado por cotas de
  múltiplos convidados via Pix, até completar o valor. Uma `Contribution` pendente
  reserva o valor do presente mas **expira em 48h** se o dono não confirmar,
  liberando o valor de novo.
- ❌ Sem gateway de pagamento — confirmação de "recebido"/"cota confirmada" é
  manual, feita pelo dono do evento no painel
- ❌ Sem conta de convidado — acesso via link+senha do evento; nome do convidado é
  auto-declarado (não verificado) no primeiro acesso
- ✅ Cadastro de presente é assistido: sistema tenta buscar metadados via serviço
  de link-preview (ex: Microlink/LinkPreview), preenche o que conseguir, e sempre
  permite edição/preenchimento manual dos campos que faltarem

### Decisão tomada durante a Sprint 2 (corrige o que o planejamento original dizia)
**Não existe "modo de pagamento" por evento.** O dono só cadastra a chave Pix
(sempre obrigatória, usada pra gerar QR codes). Link da loja é um dado de cada
`Gift` (`product_url`), não uma escolha do evento — os dois métodos de pagamento
(Pix e link) ficam sempre disponíveis pro convidado na hora de reivindicar,
decidido presente a presente, nunca configurado antecipadamente pelo dono.

### Extensão de escopo decidida durante a Sprint 2 (não estava no planejamento original)
Eventos têm um campo `eventType` (`casamento` / `aniversario` / `cha_de_bebe` /
`cha_de_cozinha` / `outro`) — o produto não é exclusivo pra casamentos. A marca
em uso na UI é "WebGift" (ainda não confirmada como nome final).

## Stack

- **Frontend**: Next.js (App Router) — monorepo em `apps/frontend`
- **Backend**: Nest.js + Prisma — monorepo em `apps/backend`
- **Banco de dados**: PostgreSQL
- **Hosting (já em produção, não é mais "proposto")**: Vercel (front) + Render
  (back) + Neon (Postgres, região EUA-leste, perto do Render)

## Modelo de dados

### Já implementado (Sprints 1 e 2)
- `User`: dono do evento — `id`, `name`, `email`, `passwordHash`, `createdAt`
- `Event`: pertence a um `User`; `id`, `ownerId`, `eventType`, `title`,
  `eventDate`, `slug` (único, gerado pelo backend — nunca escolhido manualmente),
  `guestPasswordHash`, `pixKey` (sempre obrigatória), `createdAt`

### Ainda não implementado (Sprint 3+, conforme planejamento v2)
- `Gift`: pertence a um `Event`; `product_url`, `title`, `image_url`, `price`,
  `price_source` (`auto`/`manual`), `status` (`available` / `partially_funded` /
  `fully_funded` / `purchased_via_link` / `confirmed`)
- `Contribution`: liga um `Gift` a um convidado (nome auto-declarado); `amount`,
  `status` (`pending` / `confirmed` / `expired`), `created_at`, `expires_at`
  (`created_at` + 48h), `confirmed_at` (nullable)
- `EventExtraFunds`: registro contábil (não movimenta dinheiro de verdade) criado
  quando um presente com cotas já confirmadas é comprado por completo via link —
  o valor das cotas confirmadas vira saldo extra do casal. Visível só pro dono.

**Regra crítica de concorrência (Sprint 3+)**: valor disponível de um `Gift` =
`price - SUM(amount de Contribution com status pending ou confirmed)`. Toda nova
contribuição precisa validar, dentro de uma transação atômica, que não ultrapassa
esse saldo — mesmo tipo de problema de concorrência de uma reivindicação simples,
só que somado em vez de binário. Qualquer implementação desse fluxo deve ser
revisada com isso em mente.

## Como ajudar como assistente de IA neste projeto

- Time de 4 pessoas, nenhuma com experiência prévia em Next.js/Nest.js (mas já programaram outros backends antes). Priorize clareza e explicação sobre esperteza/abstrações avançadas — código que o time consiga entender e debugar sozinho depois é mais valioso que código "elegante".
- Prazo apertado (6 semanas, ver plano de sprints). Evite sugerir refatorações grandes ou introduzir dependências novas sem necessidade clara.
- Antes de implementar qualquer fluxo de pagamento além do que está descrito acima, pare e pergunte — é a área de maior risco de compliance do projeto.
- Sprint 6 é buffer, não é para features novas — se estiver ajudando a planejar trabalho para a sprint 6, priorize correção de bugs e polimento, não escopo novo.


