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
  de link-preview, preenche o que conseguir, e sempre permite edição/preenchimento
  manual dos campos que faltarem

### Decisão tomada no início da Sprint 3: e-commerces suportados são limitados
**Apenas Mercado Livre e Amazon** têm integração de auto-fetch no MVP. Qualquer
outra loja (Shopee, Magalu, etc.) retorna erro claro de "e-commerce não suportado"
e cai direto pro preenchimento manual — não existe "tentar Microlink em qualquer
URL" como suporte oficial. Mercado Livre usa a API oficial (fallback técnico
Microlink); Amazon usa a Bright Data Web Scraper API (fallback Microlink).

**Mercado Livre exige OAuth — confirmado por teste real no Dia 1 da Sprint 3**:
`GET /items/{id}` sem token retorna `403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES`.
Não existe atalho sem autenticação. Ver `MercadoLivreToken` no modelo de dados.

**Decisão do Dia 3 da Sprint 3 (testes reais, corrige o texto acima sobre o ML):**
- Mesmo COM token OAuth válido, `GET /items/{id}` devolve `403 access_denied`
  para anúncios de outros vendedores. O caminho principal do ML passou a ser o
  **catálogo**: `GET /products/{productId}` (URLs `/p/MLB...`), que traz título
  (`name`) e imagem (`pictures[0].url`).
- **O preço do Mercado Livre NÃO vem** (`buy_box_winner` é `null`). No ML o
  preço é sempre digitado pelo dono (`priceSource = 'manual'`) — isso é o caso
  normal, não erro. O formulário só destaca o campo.
- **Sem fallback Microlink pro ML** (ele devolve só o título/logo genéricos do
  site). Falhou? Campos vazios e preenchimento manual. Microlink segue só como
  fallback técnico da Amazon.
- `productId` (`/p/MLB...`, catálogo) e `itemId` (`?wid=` ou `/MLB-123-...`,
  anúncio) são IDs diferentes — nunca usar um no endpoint do outro. O `wid`
  dos links de recomendação vem DEPOIS do `#`.
- Falha de token (`invalid_grant`, ML não conectado) nunca bloqueia o cadastro
  de presente: o preview devolve campos vazios e o log pede pra refazer
  `GET /auth/mercadolivre/connect`.

**Decisões do Dia 4 da Sprint 3:**
- **ML sem `/p/MLB`**: o `MercadoLivreService` tem 3 camadas — catálogo (único
  confirmado), multiget `GET /items?ids=` e descoberta do catálogo pelo header
  `Location` da página do anúncio. As duas últimas **não foram validadas contra o
  ML real** (sem rede no desenvolvimento): o log diz qual camada funcionou, e o
  `apps/backend/test-product-metadata.mjs` testa cada uma. Nunca ler/raspar o HTML.
- **Links encurtados da Amazon** (`a.co`, `amzn.to`, `amzn.eu`, `amzn.asia`) são
  suportados: redirect manual (só em hosts de encurtador, abortando qualquer
  redirect pra fora) e, se a Amazon bloquear, Microlink só pra descobrir a URL
  final. Falhou → `422 SHORT_LINK_UNRESOLVED`. Encurtadores do ML continuam sem suporte.
- O preview devolve `resolvedUrl`; o frontend salva ESSE valor em `Gift.productUrl`
  (link completo), nunca o link encurtado.
- CRUD de `Gift` (`POST/GET/PATCH /events/:slug/gifts`): `eventId` sempre vem do
  evento do dono; presente de outro evento = 404; `price` obrigatório (> 0, 2
  casas); mudar preço → `priceSource = 'manual'`; preço não pode cair abaixo do
  reservado (409) nem mudar após `fully_funded`/`purchased_via_link`/`confirmed`
  (409). `DELETE` existe (fora do plano original): só presente `available` e sem
  nenhuma `Contribution`, senão 409. `productUrl`/`imageUrl` só `http`/`https`.
- Sprint 4 deve revalidar, dentro da transação da cota, que o preço atual cobre o
  valor reservado (há uma janela entre o PATCH de preço e a criação de cotas).

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

- `Gift`: pertence a um `Event`; `product_url`, `title`, `image_url`, `price`,
  `price_source` (`auto`/`manual`), `status` (`available` / `partially_funded` /
  `fully_funded` / `purchased_via_link` / `confirmed`) — schema migrado na
  Sprint 3, Dia 1. Ainda sem endpoints (CRUD chega nos próximos dias da sprint).
- `Contribution`: liga um `Gift` a um convidado (nome auto-declarado); `amount`,
  `status` (`pending` / `confirmed` / `expired`), `created_at`, `expires_at`
  (`created_at` + 48h), `confirmed_at` (nullable) — schema migrado, Sprint 3 Dia 1.
- `EventExtraFunds`: registro contábil (não movimenta dinheiro de verdade) criado
  quando um presente com cotas já confirmadas é comprado por completo via link —
  o valor das cotas confirmadas vira saldo extra do casal. Visível só pro dono.
  Schema migrado, Sprint 3 Dia 1.
- `MercadoLivreToken`: única linha (`id` fixo), guarda `accessToken`/`refreshToken`/
  `expiresAt` da ÚNICA conta de integração do Mercado Livre usada pelo sistema
  (não é por usuário dono de evento). Schema migrado, Sprint 3 Dia 2. Nunca logar
  o conteúdo desses campos.

### Implementado no Dia 3 da Sprint 3
- `MercadoLivreService` (catálogo + retry único de 401), `MetadataService`
  (identifica a loja e normaliza em `GiftPreview`) e
  `POST /events/:slug/gifts/preview` (JWT + ownership 404 + rate limit).
  Loja fora do escopo → `422 UNSUPPORTED_ECOMMERCE`.
- Frontend: `AddGiftForm` usa o preview real; diferencia "e-commerce não
  suportado" de "campo não veio" (`missingFields`).

### Implementado no Dia 4 da Sprint 3
- `GiftsService` + `POST/GET/PATCH /events/:slug/gifts`; `AddGiftForm` salva de
  verdade; `GiftList` (lista + edição inline) no painel do evento.
- Amazon: links encurtados. ML: camadas extras pra links sem `/p/MLB`.

### Ainda não implementado (Sprint 3, Dia 5 em diante)
- Testes do endpoint de preview e dos DTOs de presente; validação em produção
  das camadas novas do ML e do `a.co`.
- Exclusão de presente (não está no planejamento do MVP — decidir se entra).

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

### Implementado no Dia 1 da Sprint 4 (sessão do convidado)
- `POST /events/:slug/access` agora recebe `{ password, name }` e devolve
  `{ accessToken, guest, event }`. O token é de **convidado**: payload
  `{ typ:'guest', sid, eventId, name }`, assinado com chave **derivada** do
  `JWT_SECRET` (nunca a do dono), 7 dias. `JwtAuthGuard` recusa token de convidado;
  `GuestAuthGuard` (em `auth/`) protege as rotas do convidado.
- `GET /events/:slug/guest/overview` (módulo `guest/`): evento **sem `pixKey`** +
  presentes com `reservedAmount`/`availableAmount`. A chave Pix só pode sair no
  momento de contribuir (Sprint 4, Dias 2–3). Sessão de outro evento → 401.
- Regra de saldo em `gifts/gift-reservation.util.ts` (confirmadas + pendentes com
  `expiresAt` futuro) — compartilhada entre dono e convidado. Não duplicar.
- Frontend: cookie httpOnly **por evento** (`gift_guest_<slug>`, `lib/guest-cookie.ts`),
  BFF `/api/events/[slug]/access` (POST/DELETE), `/[slug]` é Server Component com
  `GuestGate` (senha+nome) e lista real. O token nunca vai no corpo da resposta.
- Ainda **não** existe: "minhas contribuições" (Dia 4).
- Plano completo da sprint: `docs/planejamento-mvp.md`, seção 10.

### Implementado no Dia 2 da Sprint 4 (cota por Pix)
- `POST /events/:slug/guest/gifts/:giftId/contributions { amount }` (token de convidado +
  rate limit 20/min por IP). **Reserva atômica:** dentro de `prisma.$transaction`, trava a linha
  do presente (`SELECT … FOR UPDATE`), SÓ DEPOIS lê preço e saldo, valida e grava. Nunca
  ler o saldo antes do lock.
- Regras do valor: **mínimo R$ 10 ou o restante, se menor**; teto = disponível agora (409
  `AMOUNT_EXCEEDS_AVAILABLE`); presente `purchased_via_link`/`confirmed` ou sem saldo → 409
  `GIFT_UNAVAILABLE`. Cota nasce `pending` com `expiresAt = +48h`, `guestSessionId` (sid do
  token) e o nome do convidado. Todo cálculo de saldo em **centavos** (`toCents`).
- `fully_funded` DERIVA das cotas e pode estar velho (cota expirada não atualiza o banco):
  quem decide é o saldo (`reservedByGift`), e a leitura do convidado usa `deriveGiftStatus`.
  Não confiar no `status` gravado pra bloquear nem pra exibir.
- **A chave Pix só sai na resposta da criação da cota** (`payment: { pixKey, pixPayload }`).
  Nunca no overview. O Dia 4 reabre esses dados nas "minhas cotas".
- `src/pix/pix-payload.ts`: Pix Copia e Cola **estático** (BR Code EMV + CRC16), função pura.
  Não fala com banco nenhum nem move dinheiro — o princípio central segue valendo. Chave Pix é
  texto livre: normaliza e, se não der, `pixPayload = null` (frontend mostra só a chave).
- Migration `20261012210000_add_contribution_guest_session` (`contributions.guest_session_id`).
- Frontend: `GiftContribute` (modal `<dialog>` + QR com a lib **`qrcode`**, import dinâmico) e BFF
  `/api/events/[slug]/gifts/[giftId]/contributions`.
- Decisões do time (Dia 2): comprar um presente pelo link quando já tem cotas manda o valor das
  cotas para o **fundo extra** (`EventExtraFunds`) — implementação no Dia 3; QR aprovado.

### Implementado no Dia 3 da Sprint 4 (presente completo)
- `POST /events/:slug/guest/gifts/:giftId/claim { method: 'pix' | 'link' }` (módulo `guest/`,
  `GuestClaimsService`). **`pix`** = `GuestContributionsService.create(…, 'remaining')`: cota do
  valor disponível decidido DENTRO da transação (nunca aceitar o valor do cliente aqui).
  **`link`** = fecha o presente como `purchased_via_link` (`purchasedViaLinkBy` = nome,
  `purchasedViaLinkAt`) na mesma transação com lock da linha.
- **Fundo extra:** ao fechar pelo link, cada cota **confirmada** do presente vira uma linha de
  `EventExtraFunds` (`sourceGiftId`, `note`) na MESMA transação. Cotas **pendentes** não são
  tocadas (se o dono confirmar uma depois, vai pro fundo extra — Sprint 5). Nunca devolver dados
  do fundo extra ao convidado.
- Link exige saldo > 0 (calculado, não o `status` gravado) e `productUrl` (senão 400
  `NO_PRODUCT_URL`); presente terminal → 409 `GIFT_UNAVAILABLE`.
- Migration `20261013120000_add_gift_purchased_via_link`. O `GET /events/:slug/gifts` do dono
  devolve `purchasedViaLinkBy/At`.
- Frontend: `GiftClaim` (escolha Pix/link; "Já comprei" é quem fecha o presente) e
  `PixPaymentView` (tela de pagamento compartilhada com `GiftContribute`). O repasse do cookie
  do convidado ao backend está em `lib/guest-proxy.ts` — use-o em rotas novas do convidado.
- "Já comprei" é irreversível pelo convidado: reversão pelo dono fica para a Sprint 5.
