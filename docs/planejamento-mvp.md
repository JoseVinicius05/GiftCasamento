# Sistema de Lista de Presentes por Evento — Planejamento MVP

> **Revisão 10 — Sprint 5 com decisões confirmadas + Dia 1 implementado** (revisão 9: Dia 5 da Sprint 4 e planejamento da Sprint 5).
> Tudo que mudou em relação à versão anterior está marcado com **🔄 Alterado** ou **🆕 Novo**.
> O motivo das mudanças: testes reais contra a API do Mercado Livre mostraram que o
> `GET /items/{id}` é bloqueado para anúncios de outros vendedores (mesmo com OAuth) e que o
> catálogo (`/products/{id}`) **não traz preço**. O restante do plano segue de pé.

## Histórico de revisões

| Revisão | Quando | O que mudou |
|---|---|---|
| 1 | Início do projeto | Plano original do MVP |
| 2 | Fim da Sprint 2 | Cotas via Pix; fim do "modo de pagamento" por evento; só Mercado Livre e Amazon |
| 3 | Sprint 3, Dia 3 | Mercado Livre pelo **catálogo**, **sem preço automático** e **sem fallback Microlink**; Amazon via Bright Data; `GiftPreview`/`missingFields`; erro `UNSUPPORTED_ECOMMERCE` (422); riscos novos; ajustes nos Dias 3–5 da Sprint 3 |
| 4 | Sprint 3, Dia 4 | CRUD de presentes (`POST/GET/PATCH`); **links encurtados da Amazon (`a.co`) suportados**; **ML sem `/p/MLB` em 3 camadas** (catálogo → multiget → descoberta por redirect; as duas últimas ainda **não validadas** contra o ML real); `resolvedUrl` no preview; regras de preço no `PATCH` |
| 5 | Sprint 4, Dia 1 | Detalhamento dia a dia da **Sprint 4** (seção 10); **sessão do convidado** (token próprio, `sid`), `GET /events/:slug/guest/overview` e página pública `/[slug]` com dados reais; registra que a **exclusão de presente já existe** (o plano dizia que não) e que o link do painel do dono estava errado |
| 6 | Sprint 4, Dia 2 | **Cota por Pix** com reserva atômica (lock da linha do presente) e expiração de 48h; **Pix Copia e Cola + QR Code** antecipados do Dia 3 (QR aprovado, dependência `qrcode`); `Contribution.guestSessionId` migrado; valor mínimo da cota = R$ 10 ou o restante; **decisão:** presente comprado pelo link com cotas → valores das cotas vão para o fundo extra |
| 7 | Sprint 4, Dia 3 | **Presente completo:** `POST …/guest/gifts/:giftId/claim` com `pix` (cota do valor restante, mesma tela de pagamento) ou `link` ("comprei pelo link", fecha o presente); **cotas confirmadas viram linhas do `EventExtraFunds`** na mesma transação; migration `gifts.purchased_via_link_by/at`; dono vê quem comprou pelo link |
| 8 | Sprint 4, Dia 4 | **"Minhas contribuições":** listar as cotas da própria sessão, **reabrir o Pix** de uma cota pendente e **cancelar** (reaproveita `expired`, sem migration); cancelar recalcula o status do presente sob lock; estados dos cards por motivo (comprado / reservado / garantido); `Esc` volta a fechar o modal de pagamento |
| 9 | Sprint 4, Dia 5 + Sprint 5 | **Dia 5:** lock da linha do presente no `PATCH` de preço e no `DELETE` (fecha as janelas contra cotas), status **derivado** também na API do dono, **teste de concorrência real** (`npm run test:integration`), rate limit das rotas do convidado **por sessão** (não por IP), testes de controller/DTO de presentes, `ErrorState` corrigido, roteiro de validação em produção. **Sprint 5 detalhada dia a dia (seção 11)** |
| 10 | Sprint 5, Dia 1 | **Decisões da Sprint 5 confirmadas** (seção 11). **Dia 1:** `GET /events/:slug/contributions` e `GET /events/:slug/summary` (dono), painel **"Cotas e pagamentos"** com resumo, filtros e referência do QR; migration `event_extra_funds.contribution_id` (única) já usada pelo "comprei pelo link". **Desvio detectado no código atual:** senha de convidado em **texto puro** (pendência na seção 11) |

---

## 1. Escopo do MVP (v1)

**Dentro do escopo:**

- Criação de evento (casamento, chá, etc.) por um usuário autenticado (dono do evento).
- Dono adiciona presentes via link de produto → auto-fetch assistido de metadados (título,
  imagem, preço **quando disponível**) com fallback de preenchimento manual.
- 🔄 **E-commerces suportados no MVP: apenas Mercado Livre e Amazon.**
  - **Mercado Livre:** API oficial (OAuth), **endpoint de catálogo (`/products/{id}`)**. Traz
    título e imagem. **O preço do Mercado Livre não vem automaticamente — o dono sempre
    digita o preço** (`priceSource = 'manual'`). **Não há fallback Microlink para o ML** (ele
    só devolve o título/logo genéricos do site, o que seria pior que campo vazio).
  - **Amazon:** Bright Data (integração principal) com Microlink como fallback técnico.
  - Qualquer outra loja (Shopee, Magalu, etc.) retorna `422 UNSUPPORTED_ECOMMERCE` e cai direto
    pro preenchimento manual — não existe "tentar Microlink em qualquer URL" como suporte oficial.
  - 🆕 **Links encurtados da Amazon** (`a.co`, `amzn.to`, `amzn.eu`, `amzn.asia`) são aceitos: o
    backend resolve o link completo antes de buscar (redirect direto; se a Amazon bloquear,
    Microlink só pra descobrir a URL final). Se nada resolver: `422 SHORT_LINK_UNRESOLVED` e o
    dono cola o link completo. O link **salvo** é sempre o completo (`/dp/ASIN`).
  - 🆕 **Mercado Livre sem `/p/MLB`** (anúncio clássico `/MLB-123-titulo_JM`): tentativa em
    camadas — multiget (`/items?ids=`) e descoberta do catálogo pelo redirect da página. **É
    best-effort e ainda não foi validado em produção**; se nada funcionar, o dono preenche à mão.
  - Links encurtados do **Mercado Livre** (`meli.la`, `mercadolivre.com/sec/`) continuam sem suporte.
- Cada presente pode ser comprado por completo (via link do e-commerce ou Pix integral) ou por
  cotas parciais via Pix — múltiplos convidados contribuem até completar o valor.
- 🆕 O valor do presente (**preço-alvo**) é sempre confirmado pelo dono no cadastro, venha
  ele do auto-fetch ou digitado. As cotas são calculadas em cima desse valor.
- Se um presente com cotas já confirmadas for comprado por completo via link por outro
  convidado, o valor das cotas já confirmadas vira um registro de saldo extra do casal
  (`EventExtraFunds`) — não é uma transferência real, é só anotação, já que o dinheiro do Pix
  já está na conta do dono desde a confirmação.
- Acesso do convidado: link + senha únicos do evento; nome auto-declarado no primeiro acesso,
  sem criação de conta.
- Pagamento: o sistema não processa dinheiro. Os dois métodos (link do e-commerce e chave Pix
  do dono, integral ou por cota) ficam sempre disponíveis, decididos presente a presente.
- Confirmação de "presente entregue/pago" (ou de uma cota) é manual, feita pelo dono.
- Contribuição de cota pendente reserva o valor do presente, mas expira em 48h se não for
  confirmada, liberando o valor de novo.

**Fora do escopo (v2+):** gateway de pagamento (Pix dinâmico, split, custódia); contas de
convidado com autenticação própria; multi-idioma / multi-moeda; 🆕 preço automático do
Mercado Livre (exigiria outra fonte — ver "Pontos em aberto").

---

## 2. Modelo de dados inicial (Postgres)

**User (dono do evento):** `id, name, email, password_hash, created_at`

**Event:** `id, owner_id (FK User), title, event_type (enum), event_date, slug,
guest_password_hash, pix_key (SEMPRE obrigatória), created_at`

> Decisão da Sprint 2: não existe "modo de pagamento" por evento. O link da loja não é um dado
> do Event — cada Gift tem seu próprio `product_url`.

**Gift:** `id, event_id (FK Event), product_url, title, image_url, price, price_source (enum:
auto | manual), status (enum: available | partially_funded | fully_funded | purchased_via_link
| confirmed), created_at`

> 🆕 `product_url` salvo é o `resolvedUrl` do preview (nunca o link encurtado). `price` é obrigatório no banco. Como no Mercado Livre o preço nunca vem do auto-fetch,
> o `POST /events/:slug/gifts` (Dia 4) **exige** que o dono informe o preço quando
> `metadata.price` for nulo, gravando `price_source = 'manual'`.

**Contribution:** `id, gift_id (FK Gift), guest_display_name, amount, status (enum: pending |
confirmed | expired), created_at, expires_at (created_at + 48h), confirmed_at (nullable)`

> ✅ **Sprint 4, Dia 2 (migrado):** `Contribution.guest_session_id` (opcional, indexado) — liga a
> cota à sessão do convidado que a criou, porque o nome é auto-declarado e pode repetir.
> ✅ **Sprint 4, Dia 3 (migrado):** `Gift.purchased_via_link_by` / `purchased_via_link_at` — quem
> marcou "comprei pelo link" (nome auto-declarado) e quando. Detalhes na seção 10.

**EventExtraFunds:** `id, event_id (FK Event), amount, source_gift_id (FK Gift, nullable),
note, created_at`

**MercadoLivreToken:** `id (fixo = 1), accessToken, refreshToken, expiresAt, createdAt,
updatedAt` — uma única conta de integração para o sistema inteiro (não é por dono de evento).
Nunca logar o conteúdo desses campos.

### 🔄 Interfaces internas de normalização (backend, não são tabelas)

```ts
type MetadataSource = 'mercadolivre-api' | 'brightdata' | 'microlink' | null;

interface ProductMetadata {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  source: MetadataSource;
}

// 🆕 O que o endpoint de preview devolve ao frontend
interface GiftPreview extends ProductMetadata {
  store: 'mercadolivre' | 'amazon';
  missingFields: ('title' | 'imageUrl' | 'price')[]; // o que o dono precisa preencher
  resolvedUrl: string; // 🆕 Dia 4: link completo do produto (≠ colado se era a.co) — é ESTE que se salva
}
```

**Notas:**

- `slug` + `guest_password_hash` no Event resolvem o acesso por link+senha.
- Uma Contribution `pending` reserva o valor no cálculo do saldo. Se não for confirmada em 48h
  (`expires_at`), um job/verificação marca como `expired` e o valor volta a ficar disponível.
- Valor disponível de um Gift = `price - SUM(amount de Contribution pending ou confirmed)`. Toda
  nova contribuição valida, dentro de uma transação atômica, que não ultrapassa esse saldo.
- Se `SUM(confirmed) == price` → `fully_funded`.
- Se o presente for comprado por completo via link enquanto já existem Contribution confirmadas:
  status vira `purchased_via_link`, e cada Contribution confirmada gera uma linha em
  `EventExtraFunds`. É só registro contábil — o sistema não movimenta dinheiro.
- `EventExtraFunds` é visível apenas para o dono do evento.

---

## 3. Fluxos principais

1. **Criar evento:** dono cria conta → cria evento (título, tipo, data, chave Pix, senha de
   convidado) → sistema gera slug.
2. 🔄 **Adicionar presente:** dono cola a URL → `POST /events/:slug/gifts/preview` identifica a
   loja pelo domínio → *Mercado Livre:* catálogo (título + imagem); *Amazon:* Bright Data
   (+ Microlink) → formulário pré-preenchido com os campos que vieram; **campos que não vieram
   (sempre o preço no ML) ficam destacados e editáveis** → dono confirma/edita → salva.
   - Loja fora do escopo → `422 UNSUPPORTED_ECOMMERCE` → formulário manual com aviso próprio.
   - 🆕 Link encurtado da Amazon que não resolve → `422 SHORT_LINK_UNRESOLVED` → manual, pedindo o
     link completo.
   - 🆕 Salvar: `POST /events/:slug/gifts` com título, **preço (obrigatório)**, `priceSource`,
     `productUrl` (= `resolvedUrl`) e `imageUrl`; a lista do painel atualiza em seguida.
   - Falha de integração (token do ML inválido, timeout, 403) **nunca** vira erro 500: o preview
     volta com campos vazios e o dono preenche tudo manualmente.
3. **Convidado acessa:** abre o link do evento → digita a senha → (primeiro acesso) digita o
   nome → sessão criada.
4. **Reivindicar presente:** convidado escolhe um presente → paga por completo (link ou Pix) ou
   contribui com uma cota via Pix → reserva atômica de valor.
5. **Confirmar recebimento:** dono acessa o painel → confirma cota/compra manualmente.

---

## 4. Riscos já mapeados

- Metadados de preço nem sempre disponíveis — UX trata isso como normal, não como erro.
  🔄 **No Mercado Livre o preço nunca vem**; na Amazon vem quando a Bright Data responde.
- Nome do convidado é auto-declarado, sem verificação — aceitável para o contexto social.
- Confirmação de pagamento é 100% manual no v1 — atrito assumido para reduzir compliance.
- 🆕 **`GET /items/{id}` do ML é bloqueado para anúncios de terceiros** (`403 access_denied`,
  mesmo com token válido). Dependemos do catálogo (`/products`), que só existe para links
  `/p/MLB...`. **URLs clássicas de anúncio (`/MLB-123-titulo_JM`) têm só tentativas best-effort
  (multiget e redirect, Dia 4), ainda não validadas; se falharem, caem no modo manual.** Se o ML mudar a política do catálogo, o ML inteiro vira manual — o sistema continua
  funcionando, só sem auto-preenchimento.
- 🆕 **Preço-alvo digitado pelo dono pode ficar defasado** em relação à loja (preço sobe/desce
  depois do cadastro). As cotas seguem o valor cadastrado; o dono pode editar o preço no
  `PATCH` (Dia 4) enquanto não houver cotas confirmadas.
- 🆕 **Conta de integração única do ML:** se o `refresh_token` for revogado (`invalid_grant`),
  o auto-fetch do ML para até alguém refazer `GET /auth/mercadolivre/connect`. O cadastro de
  presentes **não** é bloqueado — só perde o preenchimento automático.
- 🆕 **Lock de refresh em memória** vale para um único processo do backend. Com mais de uma
  instância seria preciso lock distribuído (débito técnico documentado).
- 🆕 **Links encurtados da Amazon dependem da Amazon deixar resolver.** Há relatos de que ela
  bloqueia resolução automatizada; por isso a camada 2 (Microlink). O custo é 1 chamada extra de
  Microlink quando o redirect direto falha. `meli.la` (ML) segue sem suporte.
- 🆕 **Descoberta por redirect no ML** depende de o site responder a um cliente automatizado com
  um redirect real (e não uma tela de verificação). Só lê o cabeçalho `Location`, nunca o HTML.
- 🆕 **Janela entre `PATCH` de preço e criação de cota:** o backend impede baixar o preço abaixo do
  reservado, mas uma cota pode entrar no mesmo instante. A Sprint 4 revalida o preço dentro da
  transação da cota.
- 🆕 **Custo/abuso do preview:** a rota aciona serviços pagos (Bright Data/Microlink). Mitigação:
  JWT + ownership antes de qualquer chamada externa, só domínios reconhecidos chegam nos
  provedores, e rate limit de 15 consultas/min por IP.

---

## 5. Hosting — opções para discussão

| Componente | Opção A (mais simples) | Opção B (mais controle) |
|---|---|---|
| Frontend (Next.js) | Vercel | Railway/Render |
| Backend (Nest.js) | Railway ou Render | VPS próprio (Hetzner/DigitalOcean) |
| Postgres | Neon ou Supabase | Postgres gerenciado na mesma Railway/Render |
| Imagens de presente | Hotlink direto da URL do e-commerce | Bucket S3-compatível (Cloudflare R2) |

Em produção hoje: Vercel + Render + Neon (Opção A). 🆕 As imagens vêm por hotlink de
`mlstatic.com`/Amazon — se algum dia a loja bloquear hotlink, migrar para R2.

---

## 6. Sprints (6 semanas, time de 4 pessoas)

Premissa: 2 pessoas em backend (Nest/Postgres), 2 em frontend (Next.js), com revisão cruzada.

| Sprint | Foco | Entregável no fim da semana | Status |
|---|---|---|---|
| 1 | Setup + fundamentos + login/autenticação | Repo, hosting no ar, schema inicial, cadastro/login em produção | ✅ |
| 2 | Criação de evento | Evento (slug + senha de convidado), painel do evento | ✅ |
| 3 | Cadastro de presentes + modelo de cotas | Formulário de presente (metadados + fallback manual), preço-alvo, schema de Contribution/EventExtraFunds | 🔄 Dias 1–4 ✅; Dia 5 (testes de controller/DTO, validação em produção) virou débito da Sprint 4 |
| 4 | Acesso do convidado + reivindicação (completa e por cota) | Login de evento, nome, reivindicar completo ou cota, reserva atômica e expiração de 48h | ✅ Dias 1–5 no código; falta só o roteiro de validação em produção — ver seção 10 |
| 5 | Pagamento manual + confirmação + saldo extra | Painel de confirmação, `EventExtraFunds`, e-mail/notificação simples | 🔄 em andamento (Dia 1 ✅) — seção 11 |
| 6 | Testes, polimento e go-live | Concorrência, UX, bugs, deploy final — **buffer** | — |

A sprint 6 é deliberadamente um buffer, não uma sprint de features novas.

---

## 7. Detalhamento — Sprint 1 ✅ (concluída)

Dia 1 fundação (repo, Nest, Postgres/Docker, Prisma, Next, Vercel) · Dia 2 `User` +
`POST /auth/register` + tela de cadastro, deploy Render/Neon · Dia 3 `POST /auth/login` + JWT +
`JwtAuthGuard` + `GET /auth/me`, cookie httpOnly via Route Handler · Dia 4 rate limit no login,
mensagens genéricas, testes do `AuthService`, middleware de rota, teste em produção · Dia 5
revisão cruzada, README, retro.

**Checklist de saída:** cadastro ✅ · login com cookie httpOnly ✅ · rota protegida ✅ · front,
back e banco hospedados ✅.

---

## 8. Detalhamento — Sprint 2 ✅ (concluída)

Dia 1 modelo `Event` + geração de slug · Dia 2 `POST/GET /events` + "Meus eventos" · Dia 3
`GET/PATCH /events/:slug` com guard de ownership + painel · Dia 4 validações +
`POST /events/:slug/access` · Dia 5 revisão e README.

> Nota: o texto original desta sprint falava em `payment_mode`. Isso foi **removido na própria
> Sprint 2** — a chave Pix é sempre obrigatória e o link da loja é do `Gift`.

**Checklist de saída:** evento com slug único e senha ✅ · edição só do próprio evento (404,
nunca 403) ✅ · verificação de senha do convidado ✅ · 🔄 "modo de pagamento selecionável"
substituído pela decisão acima.

---

## 9. Detalhamento — Sprint 3 (dia a dia)

Mesma divisão: Dupla A (backend) e Dupla B (frontend). Essa sprint é só o lado do dono
cadastrando presentes — a página pública do convidado (ainda mockada) ganha dados reais na
Sprint 4.

### 🔄 Decisões travadas (com evidência de teste real)

| Tema | Decisão | Evidência |
|---|---|---|
| OAuth do ML | Obrigatório | `GET /items/{id}` sem token → `403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES` (Dia 1) |
| `/items` com token | **Não funciona para anúncios de terceiros** | `403 access_denied` com token válido (Dia 3) |
| Caminho principal do ML | **`GET /products/{productId}`** (catálogo) | 200 com `name` e `pictures` (Dia 3) |
| Preço do ML | **Sempre manual** | `buy_box_winner` = `null` nos produtos testados |
| Fallback Microlink no ML | **Removido** | Devolve só "Mercado Livre" + logo genérico |
| IDs do ML | `productId` (`/p/MLB…`) ≠ `itemId` (`?wid=` / `/MLB-123-…`) | `/items/{productId}` → 404 |
| `wid` | Fica depois do `#` nos links de recomendação | Parser lê query **e** fragmento |
| Amazon | Bright Data principal, Microlink fallback | — |
| Loja fora do escopo | `422` com `code: 'UNSUPPORTED_ECOMMERCE'` | — |

### Dia 1 (Segunda) — ✅ Concluído

Schema `Gift`/`Contribution`/`EventExtraFunds` migrado · tela "Adicionar presente" (mock) ·
teste de autenticação do ML documentado (OAuth obrigatório).

### Dia 2 (Terça) — ✅ Concluído — OAuth do Mercado Livre + Amazon

- Dupla A: `MercadoLivreToken` + migration; fluxo de primeira autorização
  (`GET /auth/mercadolivre/connect` → callback troca o `code` por tokens);
  `MercadoLivreTokenService.getValidAccessToken()` com margem de 5 min; lock em memória contra
  refresh concorrente.
- Dupla B: `AmazonExtractor` (Bright Data + Microlink) e o BFF
  `/api/events/[slug]/gifts/preview`.

### Dia 3 (Quarta) — ✅ Concluído — Fechar OAuth + endpoint de preview

**Dupla A (backend):**

- 🔄 Token service fechado: erro tipado `MercadoLivreAuthError` (com `code`, ex.
  `invalid_grant`, `not_connected`) e `forceRefresh(staleToken)` — se outra requisição já
  renovou o token, devolve o novo **sem** gastar um segundo refresh.
- 🔄 `MercadoLivreService.fetchMetadata(url)` (substitui o previsto `getItem()/getPrice()`):
  parseia a URL → `/products/{productId}` → mapeia `name`/`pictures`/`buy_box_winner`.
  `/items/{itemId}` só em URL sem catálogo. **401 → renova e repete uma única vez.** Nunca
  lança exceção: qualquer falha vira campos vazios.
- `MetadataService.preview(url)`: identifica a loja **pelo hostname** (domínios parecidos, como
  `mercadolivre.com.br.evil.com`, não enganam), delega ao extractor, calcula `missingFields`.
- `POST /events/:slug/gifts/preview` (`GiftsController`): JWT → ownership (404 padrão, **antes**
  de qualquer chamada externa) → rate limit 15/min → `MetadataService`.
- Testes: parser de URL, serviço do ML (catálogo, sem preço, 401 + retry único, `invalid_grant`,
  erro de rede), token service (refresh concorrente, `forceRefresh`), `MetadataService`
  (loja não suportada, campos faltando, extractor lançando).

**Dupla B (frontend):**

- `AddGiftForm` conectado ao preview real (BFF), sem o badge "simulado".
- Duas mensagens distintas: **"e-commerce não suportado"** (422 → modo manual) × **"campo não
  veio"** (200 + `missingFields` → campo destacado). Aviso específico para o preço do ML.
- Estados de erro: sessão expirada (401), evento não encontrado (404), muitas buscas (429),
  link inválido (400), servidor indisponível (502/rede) — todos com saída para o modo manual.
- Link "Prefiro preencher manualmente" sempre disponível.

**Ponto de controle:** o preview funciona de ponta a ponta mesmo com o ML desconectado
(devolve campos vazios).

### Dia 4 (Quinta) — ✅ Concluído — Salvar, editar, listar + links novos

**Dupla A (backend):**

- `POST /events/:slug/gifts` — **exige `price`** (> 0, até 2 casas); `priceSource` `auto`|`manual`;
  `productUrl`/`imageUrl` opcionais e só `http`/`https`. O `eventId` vem sempre do evento do dono.
- `GET /events/:slug/gifts` — mais recente primeiro, com `reservedAmount` (confirmadas + pendentes
  ainda dentro das 48h).
- `PATCH /events/:slug/gifts/:giftId` — presente de outro evento = 404 (padrão). Mudar o preço marca
  `priceSource = manual`, **não pode ficar abaixo do reservado (409)** e **não muda após
  `fully_funded` / `purchased_via_link` / `confirmed` (409)**. `null` apaga link/imagem. Título,
  link e imagem seguem editáveis em qualquer estágio.
- 🆕 **Amazon `a.co`/`amzn.to`:** `AmazonShortLinkService` (redirect manual só em hosts de
  encurtador + fallback Microlink pela URL final) → link canônico `/dp/ASIN`; `resolvedUrl` no preview.
- 🆕 **ML sem `/p/MLB`:** `MercadoLivreService` em 3 camadas (catálogo → multiget → descoberta de
  catálogo por redirect).
- Testes: `GiftsService`, camadas do ML, `discoverCatalogId`, encurtador da Amazon, `MetadataService`.

**Dupla B (frontend):**

- Botão **"Salvar presente"** no `AddGiftForm`: valida nome e preço (aceita `249,90`, `1.299,90`,
  `R$ 80`), manda `priceSource = auto` só se o preço do auto-fetch não foi alterado.
- `GiftList` no painel: cards com imagem, preço, status em português, "Ver na loja" e **edição
  inline** (nome/preço); preço travado nos estágios em que o backend recusa.
- Estados de erro: lista que não carrega não derruba o painel; 409 do preço mostra a mensagem do
  backend; mensagem própria para `SHORT_LINK_UNRESOLVED`.

**Não validado ainda (fazer no Dia 5, em produção):** multiget e redirect do ML; resolução do `a.co`.
O log do backend diz qual camada funcionou; `test-product-metadata.mjs` testa cada uma localmente.

### Dia 5 (Sexta) — Testes, documentação e fecho

- 🔄 Os testes dos serviços (metadados e `GiftsService`) já existem (mockando `fetch`; nunca batem
  nas APIs reais). Sobra: testes de **controller/DTOs** — preview e CRUD (ownership, 401, 422, 400,
  validação de preço e de URL com `javascript:`).
- 🆕 **Validação em produção** das camadas novas: ML de catálogo, ML clássico (qual camada
  respondeu?), Amazon completa e `a.co`. Registrar o resultado aqui e, se o multiget/redirect do ML
  não funcionarem, **remover as camadas** (menos código) em vez de manter tentativas que sempre falham.
- Atualizar README/CLAUDE.md com o CRUD de presentes. Variáveis de ambiente do módulo:
  `MICROLINK_API_KEY`, `BRIGHTDATA_API_KEY`, `MERCADOLIVRE_CLIENT_ID`,
  `MERCADOLIVRE_CLIENT_SECRET`, `MERCADOLIVRE_REDIRECT_URI`, `MERCADOLIVRE_SETUP_KEY`.

### 🔄 Checklist de saída da Sprint 3

- [x] Dono cadastra presente colando link do **Mercado Livre (catálogo)** ou **Amazon** (inclui
      `a.co`), com preview auto-preenchido de título e imagem
- [ ] 🔄 **No ML, o preço é digitado pelo dono** e o formulário avisa isso de forma clara
      (sem tom de erro)
- [ ] URL de outra loja retorna mensagem clara de "não suportado", sem travar o manual
- [x] Campos que não vieram ficam editáveis, sem travar o cadastro
- [x] Dono edita e lista os presentes do seu evento
- [x] Ownership check nos endpoints de presente segue o padrão 404
- [ ] Refresh automático do token do ML comprovadamente funcionando, sem token em log
- [ ] 🔄 2–3 URLs reais de cada loja testadas manualmente (ML: catálogo e clássica; Amazon)
- [ ] Tudo testado em produção — roteiro do Dia 5 (itens 1–8)
- [x] CRUD de presentes com preço obrigatório e regras de `PATCH` (Dia 4)
- [x] Token service com refresh concorrente, retry único de 401 e `invalid_grant` sem bloquear
      o cadastro (Dia 3)
- [x] Preview real com `UNSUPPORTED_ECOMMERCE` distinto de "campo não veio" (Dia 3)

**Retro honesta:** o que não fechar até sexta vira débito técnico explícito no início da
Sprint 4. A página pública do convidado (ainda mockada) deve ser corrigida no início da
Sprint 4.

### Pontos em aberto

- 🔄 **Camadas novas do ML sem `/p/MLB`** (multiget e redirect): validar em produção. Se nenhuma
  funcionar, decidir se aceitamos que anúncios clássicos são sempre manuais (e remover as camadas).
- 🔄 **`a.co` em produção:** conferir no log se resolve por redirect direto ou só via Microlink — se
  sempre precisar do Microlink, avaliar o custo.
- 🔄 **Excluir presente:** **já foi implementado** (`DELETE /events/:slug/gifts/:giftId`, fora do
  planejamento original): só presente `available` e **sem nenhuma `Contribution`** (nem expirada);
  caso contrário 409. Falta tratar a corrida com a criação de cota (ver Dia 5 da Sprint 4).
- 🆕 **Links encurtados do ML** (`meli.la`): resolver com a mesma técnica ou continuar pedindo o
  link completo?
- **Preço automático do Mercado Livre:** inviável pelo catálogo. Só viria do multiget, se
  funcionar. Caso contrário, aceitar o preço manual como definitivo.
- Nome/domínio do produto ("WebGift" ainda não confirmado).
- ✅ Página pública do convidado: deixou de ser mockada no Dia 1 da Sprint 4.

---

## 10. Detalhamento — Sprint 4 (dia a dia)

**Meta:** o convidado entra no evento (senha + nome), vê a lista real e consegue **reservar** um
presente — por completo (Pix integral ou "vou comprar pelo link") ou **por cota** — sem nunca
estourar o valor do presente, mesmo com várias pessoas ao mesmo tempo. Cota pendente expira em 48h.

### Ponto de partida (o que o código tinha no fim da Sprint 3)

- `POST /events/:slug/access` só conferia a senha e devolvia `{ valid: true }` — **sem sessão**.
- A página pública `/[slug]` era um **mock** (casal e presentes fictícios) e o botão apontava para
  `/checkout`, rota que nunca existiu.
- O painel do dono mostrava o link `webgift.com/evento/<slug>` — **endereço inexistente**; o real é
  `/<slug>`.
- A regra de saldo (confirmadas + pendentes não vencidas) existia só como método privado do
  `GiftsService`. Nenhum endpoint criava `Contribution`, e nada mudava o `status` do presente.
- `DELETE` de presente já existia, contrariando o plano (corrigido na seção de pontos em aberto).

### 🔄 Decisões de desenho da sprint

1. **Token de convidado separado do token do dono.** Assinado com uma chave **derivada** do
   `JWT_SECRET` (HMAC com rótulo fixo) — sem variável nova. Um token de um tipo nunca é aceito pelo
   guard do outro. Vale 7 dias e vai num **cookie httpOnly por evento** (`gift_guest_<slug>`).
2. **Payload:** `{ typ: 'guest', sid, eventId, name }`. O `sid` (UUID) identifica a sessão e é o que
   liga uma cota ao convidado — não o nome, que pode repetir.
3. **A chave Pix só sai no momento de contribuir/reservar** (Dias 2–3), nunca na listagem.
4. **Reserva atômica = linha do `Gift` travada** (`SELECT … FOR UPDATE` dentro de
   `prisma.$transaction`), recalculando o reservado **dentro** da transação. É o que fecha a janela
   citada nos riscos (PATCH de preço × criação de cota).
5. **Expiração preguiçosa (lazy), sem job:** `expiresAt` vencido já deixa de contar no saldo (isso
   já é verdade hoje); o `status` do presente é recalculado quando alguém lê/grava. Sem dependência
   nova (`@nestjs/schedule`) e sem processo extra no Render free.
6. **Sem gateway:** o app gera instruções de Pix (chave, valor, copia-e-cola); **não move dinheiro**.
   Qualquer passo além disso é mudança de escopo.

### Dia 1 (Segunda) — ✅ Implementado — Sessão do convidado + página pública real

**Backend (dupla A)**
- `GuestSessionService` (`create`/`verify`), `GuestAuthGuard` e `POST /events/:slug/access` agora
  recebe `{ password, name }` e devolve `{ accessToken, guest, event }`. Nome: 2–60 caracteres,
  espaços normalizados.
- `JwtAuthGuard` endurecido: exige `sub` e recusa `typ: 'guest'`.
- `GET /events/:slug/guest/overview` (guard de convidado): evento **sem `pixKey`** + presentes com
  `reservedAmount`/`availableAmount`. Sessão de outro evento → 401; slug inexistente → 404.
- Regra de saldo extraída para `gifts/gift-reservation.util.ts` e usada pelo dono e pelo convidado.
- Testes: sessão, guards, overview (inclui "nunca seleciona `pixKey`"), DTO e `verifyGuestAccess`.
  `http/guest.http` e `http/events.http` atualizados.

**Frontend (dupla B)**
- BFF `POST/DELETE /api/events/[slug]/access` (cookie httpOnly; o token **não** vai no corpo).
- `/[slug]` virou Server Component: sem cookie → `GuestGate` (nome + senha); 401 → gate com aviso de
  sessão expirada; 404 → `notFound()`; senão, lista real com progresso de cotas.
- Botão "Não é você? Trocar nome"; painel do dono com o **link correto** e botão **Copiar link**.
- O botão de presentear aparece **desabilitado** ("em breve") até os Dias 2–3.

**Pronto quando:** convidado entra com senha+nome, recarrega a página e continua logado; senha errada
dá mensagem clara; o token nunca aparece no JavaScript; o dono copia o link certo.

### Dia 2 (Terça) — ✅ Implementado — Cota por Pix (reserva atômica) + Pix Copia e Cola + QR

> 🔄 **Mudança de escopo em relação ao plano da revisão 5:** o gerador de **Pix Copia e Cola** e o
> **QR Code** (que eram do Dia 3) vieram para o Dia 2. Motivo: sem eles, a cota criada não teria
> como ser paga na tela. O Dia 3 fica só com o presente completo.

**Backend**
- Migration `20261012210000_add_contribution_guest_session`: `contributions.guest_session_id`
  (opcional) + índice.
- `POST /events/:slug/guest/gifts/:giftId/contributions` `{ amount }` (token de convidado + rate
  limit de 20/min por IP). Tudo dentro de `prisma.$transaction`:
  1. trava a linha do presente (`SELECT … FOR UPDATE`, filtrando por evento) — presente de outro
     evento ou inexistente → 404 sem travar nada;
  2. **só depois** lê o presente e o saldo (confirmadas + pendentes vivas) — preço e reservas atuais;
  3. `purchased_via_link`/`confirmed` → 409 `GIFT_UNAVAILABLE`; disponível = 0 → 409 igual. O
     `fully_funded` **não** bloqueia por si: ele deriva das cotas e pode estar velho (cotas
     expiradas), quem decide é o saldo calculado;
  4. valor: **mínimo R$ 10 ou o restante, se for menor** (400 `AMOUNT_BELOW_MINIMUM` + `minAmount`);
     acima do disponível → 409 `AMOUNT_EXCEEDS_AVAILABLE` + `availableAmount`;
  5. cria `Contribution` `pending`, `expiresAt = agora + 48h`, `guestSessionId` do token e o nome;
  6. grava o status do presente: `partially_funded`, ou `fully_funded` se zerou o disponível.
- Resposta (201): a cota, o presente atualizado e `payment: { pixKey, pixPayload }` — **o único
  lugar onde a chave Pix sai** para o convidado.
- `src/pix/pix-payload.ts`: **Pix Copia e Cola estático** (BR Code EMV + CRC16/CCITT-FALSE), função
  pura, sem dependência. Normaliza a chave digitada pelo dono (e-mail, UUID, CPF, CNPJ, celular);
  se não der pra normalizar com segurança, `pixPayload = null` e a tela mostra só a chave. O
  recebedor no BR Code é o **nome do dono** (sem acento, ≤ 25) e a cidade é fixa (`BRASIL`); o
  `txid` é o id da cota (sem hífens, ≤ 25) — útil para conciliar na Sprint 5.
- **Expiração preguiçosa também na leitura:** o `GET …/guest/overview` agora devolve o status
  **derivado** das cotas (`deriveGiftStatus`) e `minContribution`; um presente cujas reservas
  venceram volta a aparecer como disponível mesmo com o status velho no banco.
- Testes: pix (CRC, chaves, estrutura TLV), saldo/status derivado, criação de cota (ordem
  lock → leitura → escrita, limites, mínimo, restante < R$ 10, ponto flutuante, status velho,
  terminais, Pix) e DTO.

**Frontend**
- BFF `POST /api/events/[slug]/gifts/[giftId]/contributions` (lê o cookie httpOnly, manda o Bearer).
- `GiftContribute`: modal (`<dialog>` nativo) com valor + atalhos (R$ 10/25/50 e "Completar"),
  erros traduzidos (409 atualiza a lista e o valor disponível), e a tela de pagamento com **QR
  Code**, **Copia e Cola**, **chave Pix** e prazo de 48h. A biblioteca `qrcode` carrega só nessa
  tela (import dinâmico).
- ✅ **Limitação resolvida no Dia 4:** os dados de pagamento apareciam **uma vez só**; agora o
  convidado os reabre em "Minhas contribuições" enquanto a reserva valer.

**Pronto quando:** duas cotas somam certo, a que passaria do preço é recusada com o valor
disponível, a barra de progresso reflete a reserva e o QR abre no app do banco.

### Dia 3 (Quarta) — ✅ Implementado — Presente completo (Pix integral ou link)

**Backend**
- `POST /events/:slug/guest/gifts/:giftId/claim` `{ method: 'pix' | 'link' }` (token de convidado +
  mesmo rate limit das cotas).
  - **`pix`** = a cota do **valor que ainda está disponível**, decidido **dentro** da transação
    (depois do lock): `GuestContributionsService.create(…, 'remaining')`. Mesmas regras, mesmo
    prazo de 48h, mesmo Copia e Cola e QR do Dia 2. Resposta: `{ method: 'pix', contribution, gift, payment }`.
  - **`link`** = "comprei pelo link": na mesma transação com lock do presente, valida e fecha o
    presente (`purchased_via_link`) guardando **quem** (nome) e **quando**. Resposta:
    `{ method: 'link', gift }` — nada do fundo extra vaza para o convidado.
    - 409 `GIFT_UNAVAILABLE` se já foi comprado/confirmado ou se não há saldo (tudo reservado por
      cotas vivas); 400 `NO_PRODUCT_URL` se o presente não tem link de compra. O `fully_funded`
      gravado pode estar velho, então quem decide é o saldo calculado (cotas vencidas liberam).
- ✅ **Fundo extra:** se o presente já tinha cotas **confirmadas**, cada uma vira uma linha do
  `EventExtraFunds` (`eventId`, `amount`, `sourceGiftId`, `note` com cotista, presente e quem comprou
  pelo link) **na mesma transação** que fecha o presente — ou acontece tudo, ou nada.
- Cotas **pendentes não são tocadas** (proposta registrada na revisão 6): se o dono confirmar uma
  depois num presente já `purchased_via_link`, o valor vai para o fundo extra (Sprint 5); se
  ninguém pagou, expiram sozinhas.
- Migration `20261013120000_add_gift_purchased_via_link` (`gifts.purchased_via_link_by` e
  `purchased_via_link_at`). O `GET /events/:slug/gifts` do **dono** passou a devolver os dois
  campos.
- Testes: pix delega com `'remaining'`; link (404/401, ordem lock → leitura → escrita, terminais,
  sem link, sem saldo, status velho, quem/quando, fundo extra com e sem cotas confirmadas,
  pendentes intactas, resposta sem vazamento); `'remaining'` na cota; DTO.

**Frontend**
- BFF `POST /api/events/[slug]/gifts/[giftId]/claim`; o repasse com o cookie httpOnly virou um
  helper (`lib/guest-proxy.ts`) usado também pela rota de cotas.
- `GiftClaim`: botão "Presentear por completo" (vira "Completar o presente" quando já há cotas)
  com escolha **Pagar tudo por Pix** / **Comprar pelo link da loja**. O Pix reaproveita a tela de
  pagamento (agora o componente `PixPaymentView`, compartilhado com a cota). O link abre a loja em
  outra aba e só fecha o presente quando o convidado toca em **"Já comprei"** (aviso: marque
  *depois* de comprar). Presente sem link só oferece Pix.
- "Contribuir com uma cota" virou o botão secundário do card.
- Painel do dono: o card mostra "Comprado pelo link por *Nome* em *data*".

**Pronto quando:** pagar tudo por Pix reserva o restante com QR; "Já comprei" fecha o presente e,
se havia cotas confirmadas, o fundo extra recebe uma linha por cota; um presente fechado some
das ações dos outros convidados; o dono vê quem comprou.

### Dia 4 (Quinta) — ✅ Implementado — "Minhas contribuições", reabrir Pix e cancelar

**Backend** (tudo sob o token de convidado; a cota só é "minha" se `guestSessionId` = `sid` da
sessão — o nome, que pode repetir, nunca decide isso; cota de outra sessão = 404)
- `GET /events/:slug/guest/contributions`: cotas da sessão, mais recentes primeiro, com o presente
  (título/imagem). **Sem chave Pix.** O `status` já vem derivado: pendente com prazo vencido chega
  como `expired`.
- `GET …/guest/contributions/:id/payment`: **reabre** os dados de pagamento (chave + Copia e Cola
  regerado, mesmo `txid`) de uma cota **pendente e dentro do prazo**; confirmada/expirada →
  409 `CONTRIBUTION_NOT_PAYABLE`. É o segundo (e último) ponto em que a chave Pix sai.
- `DELETE …/guest/contributions/:id` (rate limit): **cancela a própria cota pendente**. Na transação:
  acha a cota → **trava o presente** → **relê** a cota (pode ter mudado no meio-tempo) → vira
  `expired` com `expiresAt = agora` → recalcula o **status gravado** do presente sobre o saldo sem
  ela (`fully_funded` → `partially_funded` → `available`; `purchased_via_link`/`confirmed` nunca
  são reabertos). Já confirmada ou expirada → 409 `CONTRIBUTION_NOT_CANCELLABLE`.
- ✅ **Decisão (time): cancelar reaproveita `expired`** — sem status novo e sem migration. Efeito
  conhecido: na lista, "expirou" e "cancelou" aparecem juntos ("Expirada ou cancelada").
- A geração do pagamento virou um helper (`guest-payment.ts`) usado na criação da cota e ao reabrir.
- Testes: lista (filtro por sessão/evento, sem chave Pix, status derivado), pagamento (sessão alheia,
  não pagável, Copia e Cola com `txid`), cancelamento (ordem lock → releitura → escrita, recálculo do
  status do presente, terminais intactos, 409s).

**Frontend**
- `MyContributions` (aparece só se a sessão já reservou algo): status por cota
  (**Aguardando pagamento** / **Confirmada** / **Expirada ou cancelada**), **contagem regressiva**
  das 48h (só depois de carregar no navegador, para não dar erro de hidratação), **Ver Pix**
  (reabre `PixPaymentView` em modo "reaberto") e **Cancelar reserva** com confirmação e aviso
  para não cancelar se já pagou.
- BFF `DELETE /api/events/[slug]/contributions/[id]` e `GET …/[id]/payment`; `lib/guest-proxy.ts`
  ganhou `forwardGuestRequest` (GET/DELETE).
- A página busca overview e cotas **em paralelo**; se só as cotas falharem, a lista segue.
- Estados do card por motivo: "Já comprado por outro convidado" / "Já reservado por outros
  convidados" / "Presente já garantido". Estado vazio e erros de rede já existiam.
- Como os dados de pagamento agora podem ser reabertos, o modal de pagamento voltou a fechar com
  `Esc` e a tela deixou de dizer que os dados "aparecem só agora".

**Pronto quando:** o convidado fecha a tela do Pix e a reabre em "Minhas contribuições"; cancelar
devolve o valor (a barra de progresso e o "valor disponível" voltam) e uma cota de outra sessão
nunca aparece nem pode ser mexida.

> ℹ️ **Não entra aqui:** presente marcado como "comprei pelo link" **não** aparece em "Minhas
> contribuições" — o `purchased_via_link_by` guarda só o nome, não a sessão. Se virar necessidade
> (ex.: "desfazer minha compra"), guardar também o `sid` do convidado (migration pequena).

### Dia 5 (Sexta) — ✅ Implementado — Concorrência, débitos da Sprint 3 e auditoria

O plano original tinha 5 itens. A auditoria do código (feita contra o que os Dias 1–4 entregaram)
confirmou todos e **achou mais três** — marcados com 🆕.

**Concorrência real**
- `guest-concurrency.integration.spec.ts` + `npm run test:integration` (config própria,
  `jest.integration.json`; no `npm test` comum o arquivo aparece como *skipped*). Roda **contra um
  Postgres de verdade** — é o que prova o `SELECT … FOR UPDATE`, que os testes unitários (banco
  simulado) não provam. Cenários, todos com `N` requisições simultâneas (`CONCURRENCY_N`, padrão 30):
  1. 30 convidados reservando R$ 10 de um presente de R$ 100 → **exatamente 10** passam;
  2. valores variados (sementes fixas) → soma aceita = soma no banco ≤ preço, status gravado = saldo;
  3. "pagar tudo por Pix" em paralelo → só **um** leva;
  4. cotas × "comprei pelo link" → no máximo **uma** compra pelo link, estado final coerente;
  5. cancelar × criar cotas → soma ≤ preço, status fecha com o saldo;
  6. `PATCH` de preço × cotas → preço final **nunca** abaixo do reservado;
  7. `DELETE` do presente × cotas → apaga (cotas levam 404) **ou** recusa (409) — nunca erro de FK.
  Qualquer erro que não seja 404/409 (timeout, deadlock, FK) reprova o teste.
- **Segurança do teste:** recusa rodar com `NODE_ENV=production` ou num banco que não seja local
  (`ALLOW_REMOTE_DB_TESTS=1` força, por conta e risco); cria e apaga só as próprias linhas.

**Janelas fechadas no dono (`GiftsService`)**
- `update`: transação com a linha do presente **travada** (mesmo lock de cota, link e cancelamento);
  reservado lido **depois** do lock. Fecha a janela "PATCH de preço × cota nova" registrada nos riscos
  desde a Sprint 3. O novo preço também **regrava o status** quando muda a cobertura (baixar o preço
  até o reservado → `fully_funded`).
- `remove`: contagem de cotas + exclusão na mesma transação com lock; `P2003` (FK) vira 409, não 500.

**🆕 Achados da auditoria (corrigidos)**
1. **Status velho na API do dono.** Cota pendente que expira não atualiza o banco (expiração
   preguiçosa). O convidado já via o status derivado desde o Dia 2, mas o **dono** via o gravado — um
   presente "garantido" que o convidado via livre — e um `fully_funded` velho **travava a edição de
   preço**. Agora `GET/PATCH /events/:slug/gifts` devolvem o status **derivado** (`deriveGiftStatus`) e
   a regra "preço editável" usa o derivado.
2. **Rate limit por IP não funciona atrás do BFF.** Todo o tráfego do convidado passa pelo servidor do
   Next; o backend vê o IP de **saída** dele, então muitos convidados (e eventos) caíam no mesmo balde.
   As 3 rotas autenticadas que abrem transação (cota, presentear, cancelar) agora são limitadas
   **por sessão** (`GuestThrottlerGuard`, 20/min por `sid`). O `/access` e as rotas do dono
   (login, preview) **continuam por IP** — ver decisão 3 da seção 11.
3. **`ErrorState` do painel do dono** passava `onClick` dentro de um Server Component (quebraria assim
   que uma tela de erro fosse renderizada). Virou o componente de cliente `RetryButton`
   (`router.refresh()`). Varredura nos demais arquivos: sem outros casos.

**Débitos da Sprint 3**
- Testes de **controller** (`GiftsController`, `GuestController`): guards no nível da classe, rate
  limit só onde deve, ownership **antes** de qualquer chamada paga no preview, dono/sessão sempre
  vindos do token — regressões de segurança que antes não tinham teste. Testes de **DTO**
  (`CreateGiftDto`, `UpdateGiftDto`, `PreviewGiftDto`): só http/https, texto vazio vira "não enviado",
  `null` apaga link/imagem, preço positivo com 2 casas e dentro do limite do banco.
- O `remove` não tinha **nenhum** teste; agora tem (404, não-`available`, histórico de cotas, lock,
  `P2003`).
- **Validação em produção do ML (catálogo e clássico) e da Amazon (`a.co`)** e **remover camadas do ML
  que nunca respondem**: continuam **manuais** — dependem do ambiente real e dos logs. O código **já
  registra qual camada respondeu** (`ML: dados obtidos pelo catálogo`, `… pelo multiget`,
  `Catálogo … descoberto pelo redirect`, `nenhuma camada trouxe dados`). Regra para decidir: depois de
  ~2 semanas de uso real, camada com **zero** respostas nos logs é removida na Sprint 6 (buffer).

**Pronto quando:** `npm test` e `npm run test:integration` verdes, e o roteiro abaixo executado em produção.

#### Roteiro de validação em produção (Sprint 4)

Faça com **um evento de teste** seu, em duas janelas (dono e convidado em aba anônima):

1. **Convidado entra:** senha errada → mensagem clara; certa + nome → lista real; F5 mantém a sessão;
   cookie `gift_guest_<slug>` é **HttpOnly**; a chave Pix **não** aparece na resposta do overview.
2. **Cota:** reservar R$ 10 e um valor qualquer; a 3ª que passaria do preço é recusada com o valor
   disponível; o QR abre no app do banco com o valor certo; sem QR (chave estranha) só a chave.
3. **Presente completo:** "Pagar tudo por Pix" reserva o restante; "Já comprei" fecha o presente e some
   das ações do outro convidado; o dono vê "Comprado pelo link por …".
4. **Minhas contribuições:** fechar o modal e reabrir o Pix; cancelar devolve o valor; outra sessão não
   enxerga a cota.
5. **Expiração:** com uma cota pendente, ajuste `expires_at` no banco para o passado — o presente volta
   a aparecer disponível para o convidado **e** para o dono, e o dono consegue editar o preço.
6. **Concorrência:** em duas abas, reservar "o restante" quase juntas → só uma passa. Para o teste
   automático use **só banco local** (ou um *branch* descartável, nunca o de produção):
   `npm run test:integration`.
7. **Metadados:** `a.co` real e um anúncio clássico do ML (`http/gifts.http`, blocos 8–9); anote nos logs
   do Render qual camada respondeu.
8. **Conexão com o banco:** confirme que o `DATABASE_URL` de produção suporta transações interativas
   com `SELECT … FOR UPDATE` (se for o endpoint *pooled* do Neon, confira a flag de pooler na
   documentação do Neon/Prisma) — é o que garante o lock em produção.

### Checklist de saída da Sprint 4

- [x] Convidado entra com senha + nome e mantém a sessão (cookie httpOnly) — Dia 1
- [x] Token de convidado e de dono não se aceitam mutuamente — Dia 1
- [x] Página pública usa dados reais; chave Pix não aparece na listagem — Dia 1
- [x] Cota por Pix com reserva atômica e expiração em 48h — Dia 2 (expiração preguiçosa; a prova sob concorrência real é o teste do Dia 5)
- [x] Pix Copia e Cola + QR Code na tela de pagamento — Dia 2 (antecipado do Dia 3)
- [x] Presente completo por Pix integral ou pelo link — Dia 3
- [x] Convidado vê, reabre o Pix e cancela as próprias cotas — Dia 4
- [x] Teste de concorrência **escrito** (7 cenários, `npm run test:integration`) — Dia 5
- [ ] Teste de concorrência **executado** com Postgres local (precisa de banco; ainda não rodado)
- [x] Débitos da Sprint 3 fechados ou re-datados — testes de controller/DTO feitos; validação em produção → roteiro acima; remoção de camadas do ML → Sprint 6 com regra
- [ ] Tudo testado em produção — roteiro do Dia 5 (itens 1–8)

### Riscos novos

- **Cookie de sessão por evento** — o convidado em outro aparelho precisa entrar de novo (aceito).
- **Nome auto-declarado** — duas pessoas podem usar o mesmo nome; por isso cota liga ao `sid`.
- **Render free dormindo** — o primeiro acesso do convidado pode demorar; a tela de entrada mostra
  "Entrando..." e erro amigável se o servidor não responder.
- **Link de compra** — não há como verificar que o convidado de fato comprou; é confiança + o dono
  confirmando na Sprint 5.

### ✅ Decisões confirmadas pelo time (Dia 2)

1. **Valor mínimo da cota:** R$ 10, ou o restante se for menor. *(implementado)*
2. **Presente comprado pelo link com cotas existentes:** permitido; o valor das cotas vai para o
   **fundo extra** (`EventExtraFunds`), que acumula o valor dos presentes comprados por completo
   depois de já terem cotas. *(Dia 3; tratamento das pendentes na proposta acima.)*
3. **Campos novos em `Gift`** para quem marcou "comprei pelo link": aprovados. *(Dia 3)*
4. **QR code do Pix:** aprovado; dependência `qrcode` no frontend. *(implementado no Dia 2)*

### ✅ Decisão confirmada pelo time (Dia 4)

5. **Cancelar cota:** reaproveitar `expired` (sem status novo, sem migration). *(implementado no Dia 4)*

### Riscos novos do Dia 2

- **Chave Pix é texto livre** (o dono digita como quiser). O gerador normaliza o que consegue; o
  que não consegue vira `pixPayload = null` (sem QR, só a chave). Um celular de 11 dígitos sem
  pontuação que por acaso seja um CPF válido (~1%) gera um QR que o banco recusa — nunca desvia
  dinheiro, porque o tipo da chave não bate. Mitigação futura: pedir o tipo da chave no cadastro.
- **Reserva sem pagamento segura o valor por 48h.** Um convidado pode reservar e não pagar; o valor
  só volta depois do prazo (ou do cancelamento, Dia 4). Aceito no v1.
- **Recebedor do QR é o nome do dono, cidade fixa.** O app do banco mostra o nome cadastrado na
  chave, não o do BR Code; mesmo assim o convidado deve conferir o nome na tela de confirmação do
  banco.

### Riscos novos do Dia 3

- **"Já comprei" é irreversível pelo convidado** e depende de confiança: um clique errado (ou
  malicioso) tira o presente da lista e manda as cotas **confirmadas** para o fundo extra. O aviso
  na tela reduz o erro, mas **não há como desfazer ainda** — o dono precisa poder reverter/ajustar
  isso na Sprint 5 (painel de confirmações).
- **Compra duplicada:** o presente só fecha quando o convidado marca "Já comprei", não quando abre
  a loja. Dois convidados podem comprar o mesmo item antes de qualquer um marcar. Reservar ao
  abrir a loja (com prazo) resolveria, mas está fora do plano.
- **Fundo extra só é gravado, ainda não aparece:** a tela do saldo extra é da Sprint 5.

### Riscos novos do Dia 4

- **Sessão do convidado = "minhas contribuições".** Elas vivem na sessão (cookie, 7 dias): em outro
  aparelho ou depois de limpar os cookies, o convidado não as enxerga e não consegue reabrir o Pix
  nem cancelar (a reserva ainda expira sozinha em 48h). Aceito no v1; a saída seria um código de
  recuperação ou login por e-mail, fora do plano.
- **Cancelar depois de pagar:** o cancelamento só libera o valor no sistema — não desfaz um Pix já
  feito. O aviso na tela pede para falar com os anfitriões nesse caso; o dono só vê o pagamento na
  conta (a confirmação manual é da Sprint 5).

### Riscos novos do Dia 5

- **Rate limit por sessão não impede quem abre várias sessões:** cada `/access` gera uma nova (limite por
  IP, que atrás do BFF é o IP do Next). Aceito: quem chega aí já tem a senha do evento.
- **Lock da linha depende do banco:** se um dia o backend rodar atrás de um pooler em modo que não
  mantenha a transação numa conexão, o `FOR UPDATE` perde o efeito. Item 8 do roteiro cobre isso.
- **`Gift.status` gravado segue podendo ficar velho** (expiração preguiçosa). Todas as **leituras**
  (convidado e dono) já usam o derivado; só quem lê o banco direto (relatórios) precisa saber disso.

---

## 11. Detalhamento — Sprint 5 (dia a dia)

**Meta:** o dono acompanha e **confirma** os pagamentos que o convidado diz ter feito, resolve os casos
de borda do dinheiro (Pix que chega depois do prazo, compra pelo link com cotas), vê o **saldo extra**
e é avisado quando chega uma cota. O sistema continua **sem mover dinheiro**: tudo é conferência manual.

### Ponto de partida (o que a Sprint 4 deixou)

- A cota nasce `pending` (48h); só o **convidado** mexe nela (reabrir o Pix, cancelar). **O dono não tem
  tela nem endpoint de cotas** — `confirmed` hoje só existe se alguém alterar o banco à mão.
- Cota pendente vencida continua `pending` no banco (expiração preguiçosa). As leituras já tratam
  `expiresAt` no saldo; falta mostrar isso ao dono.
- `EventExtraFunds` só **recebe** linhas (compra pelo link com cotas confirmadas) e **nada as exibe**.
- `purchased_via_link` é irreversível; o `Gift.status = confirmed` ("entregue") nunca é gravado.
- O QR leva o `txid` = id da cota (sem hífens, 25 caracteres) — serve para conciliar, mas **nem todo banco
  mostra o `txid` no extrato**: a conferência real é por valor, horário e nome do pagador.

### Decisões de desenho (✅ confirmadas pelo time na revisão 10)

1. **Confirmar cota pendente dentro do prazo** → `confirmed` + `confirmedAt`, na transação com o **mesmo
   lock da linha do presente**; o status gravado do presente é recalculado.
2. **"Recebi mesmo assim" (cota vencida/cancelada, mas o Pix caiu):** se o presente ainda comporta o
   valor → a cota vira `confirmed` e conta nele; se **não** comporta (já coberto por outros ou comprado)
   → o valor vai para o **fundo extra** e a cota fica `expired`. Exige um flag explícito
   (`acceptExpired: true`) para não acontecer por clique distraído.
3. **Não recebi** → cota `pending` vira `expired` na hora (reaproveita `expired`, como o cancelamento).
4. **Cota confirmada num presente já `purchased_via_link`** → o valor vai para o fundo extra (regra do
   Dia 3 da Sprint 4) e a cota fica `confirmed`.
5. **Idempotência do fundo extra:** nova coluna `event_extra_funds.contribution_id` (única, opcional).
   Impede lançar duas vezes a mesma cota e dá rastreabilidade (de qual cota veio cada linha).
6. **Reverter "comprei pelo link"** (o risco do Dia 3): o dono desfaz → presente volta ao status derivado,
   `purchased_via_link_by/at` limpos e **as linhas do fundo extra daquele presente são apagadas**
   (as cotas confirmadas voltam a contar no presente).
7. **`Gift.status = confirmed`** significa "o dono confirmou que o presente foi comprado/entregue" (como
   diz o schema). Botão "Marcar como entregue" + "Desfazer"; é o único status terminal que o dono controla.
8. **Fundo extra é somente leitura no v1** (lista + total + exportar); não existe "marcar como usado".
9. **Notificação:** indicador no app (contador de cotas pendentes) **primeiro**; e-mail **opcional** atrás
   de uma chave, e **nunca** bloqueia a reserva (falha de e-mail é só log). *(Interpretação registrada:
   o time aprovou a proposta como estava — indicador obrigatório; e-mail só liga se houver provedor
   configurado. Se a intenção era "sem e-mail nesta sprint", basta não configurar a chave.)*

### Dia 1 (Segunda) — ✅ Implementado — Painel de cotas do dono (leitura)

**Backend** (JWT do dono; evento de outro dono = 404, como todo o módulo — módulo novo `contributions/`)
- Migration `20261014100000_add_extra_funds_contribution_id`: `event_extra_funds.contribution_id`
  (**única**, opcional, FK `ON DELETE SET NULL`) — decisão 5. Já é usada: o "comprei pelo link" (Sprint 4,
  Dia 3) agora grava a cota de origem em cada linha do fundo extra, com `skipDuplicates` (idempotente).
- `GET /events/:slug/contributions?status=pending|expired|confirmed`: cotas do evento com nome do
  convidado, presente, valor, datas e **referência** (o mesmo `txid` do QR, `toPixTxid`, regra única).
  O `status` é o **efetivo** (pendente com prazo vencido = `expired`) e o filtro também. Ordem: pendentes
  (a que vence primeiro no topo) → vencidas (mais recentes) → confirmadas (mais recentes). A sessão do
  convidado nunca sai na resposta. *Sem paginação no v1* (centenas de cotas por evento cabem folgado).
- `GET /events/:slug/summary`: confirmado / pendente vivo / vencido (R$ e nº, somados em **centavos**, cada
  cota em um grupo só), fundo extra (R$ e nº de lançamentos) e presentes comprados pelo link.
- Refactors para a regra viver num lugar só: `contributionEffectiveStatus` (util de saldo, usado também
  em "Minhas contribuições") e `toPixTxid` (QR e painel).
- Testes: ownership (404 sem ler nada), filtro e ordem, status efetivo, totais sem dupla contagem,
  centavos, guards do controller, DTO da query.

**Frontend**
- Seção **"Cotas e pagamentos"** em `/eventos/[slug]` (`ContributionsPanel`): 4 cartões de resumo
  (confirmado, aguardando, vencidas, saldo extra), filtros com contagem (abre em "Aguardando" se houver),
  lista com convidado, presente, valor, status, datas em **fuso fixo** (Brasília — sem erro de
  hidratação), contagem regressiva só depois de montar, e referência com botão de copiar.
- A página busca cotas e resumo em paralelo; se falhar, só essa seção mostra o aviso.
- **Sem BFF GET:** a página é um Server Component e já busca direto com o token do dono (como a lista de
  presentes). Os BFFs desta sprint são só os de ação (POST), a partir do Dia 2.

**Pronto quando:** o dono vê, por evento, quem reservou o quê, o que vence quando e os totais. ✔️

### Dia 2 (Terça) — Confirmar, "Recebi mesmo assim" e rejeitar

**Backend**
- `POST /events/:slug/contributions/:id/confirm` `{ acceptExpired?: boolean }` e
  `POST …/reject`, ambos na transação: achar a cota **do evento do dono** → **travar** o presente →
  **reler** a cota → aplicar as decisões 1–4 → recalcular o status gravado do presente.
- Respostas claras e idempotentes: já confirmada → 409 `ALREADY_CONFIRMED`; vencida sem
  `acceptExpired` → 409 `CONTRIBUTION_EXPIRED` (o front então oferece "Recebi mesmo assim").
- Testes: cada ramo (dentro do prazo, vencida cabendo, vencida não cabendo → fundo extra, presente
  comprado pelo link → fundo extra, rejeitar), idempotência, ordem lock → leitura → escrita, cota de
  outro evento = 404.

**Frontend**
- Botões **Recebi** / **Não recebi** em cada cota pendente, com confirmação; para vencidas, diálogo
  **"Recebi mesmo assim"** que explica o efeito (entra no presente ou vai para o saldo extra).

**Pronto quando:** o dono confirma uma cota e o presente passa a contar o valor como confirmado; um Pix
tardio nunca estoura o preço do presente.

### Dia 3 (Quarta) — Presente entregue, reverter compra pelo link e saldo extra

**Backend**
- `POST /events/:slug/gifts/:giftId/delivered` e `…/undo-delivered` (decisão 7); só a partir de
  `fully_funded` (derivado) ou `purchased_via_link`.
- `POST /events/:slug/gifts/:giftId/revert-link` (decisão 6), com o lock do presente.
- `GET /events/:slug/extra-funds`: linhas (valor, data, nota, presente de origem se ainda existir) + total.
- Testes: transições permitidas/proibidas, reversão apaga **só** as linhas daquele presente, cotas
  confirmadas voltam a contar, presente excluído mantém a nota do fundo extra.

**Frontend**
- No card do presente (dono): **Marcar como entregue / Desfazer** e **Reverter compra pelo link**
  (com aviso do que acontece com o saldo extra). Tela **"Saldo extra"** (lista + total).

**Pronto quando:** um "Já comprei" errado é desfeito sem deixar sobra no fundo extra.

### Dia 4 (Quinta) — Avisos, resumo e exportação

- **Indicador de pendentes:** contador de cotas pendentes vivas por evento (em `GET /events` e no painel).
- **E-mail ao dono quando entra uma cota** — **opcional, desligado sem chave** (decisão 2): provedor
  (sugestão: Resend, camada gratuita), `MAIL_API_KEY` / `MAIL_FROM`, envio **fora** da transação e com
  `catch` (nunca bloqueia a reserva). O indicador no app é o que garante o aviso.
- **Exportar CSV** das cotas e do saldo extra (gerado no frontend a partir das listas; sem endpoint novo).
- Resumo financeiro final no painel e estados vazios/erros amigáveis nas telas novas.

### Dia 5 (Sexta) — Concorrência, segurança e fecho

- **Estender `guest-concurrency.integration.spec.ts`:** confirmar × cancelar × reservar × "comprei pelo
  link" no mesmo presente; confirmar a mesma cota duas vezes (só uma linha no fundo extra); reverter
  link × cota.
- Regressão de segurança nas rotas novas (todas com JWT do dono + ownership 404; teste de guards como o
  de `GiftsController`).
- **Rate limit — opção A aprovada (decisão 3):** `/access` por **slug** (60/min por evento, mais um teto
  por IP); `preview` do dono por **usuário** (15/min, em vez de por IP); login por **e-mail** (10/min por
  conta) além do IP. Mesmo padrão do `GuestThrottlerGuard` (tracker próprio). Testes de `getTracker` e de
  guards nos controllers. Acompanha a pendência da senha de convidado: sem o custo do bcrypt, o limite por
  evento passa a ser a **única** barreira contra tentativas em massa da senha.
- Documentação, checklist e retro; **roteiro de validação em produção** da Sprint 5.

### Checklist de saída da Sprint 5

- [x] Dono lista as cotas do evento com status efetivo e totais — Dia 1
- [ ] Dono confirma / rejeita cota; Pix tardio nunca estoura o preço
- [ ] Compra pelo link com cotas confirmadas → fundo extra sem duplicar linha
- [ ] Dono reverte "comprei pelo link" e marca presente como entregue (e desfaz)
- [ ] Tela de saldo extra (lista + total) e exportação CSV
- [ ] Aviso de cota pendente (indicador; e-mail se aprovado)
- [ ] Concorrência estendida **executada** em Postgres local
- [ ] Tudo testado em produção

### Riscos da Sprint 5

- **Confirmação é conferência humana:** o dono compara valor/horário/nome com o extrato; o `txid` nem
  sempre aparece. Pagamentos de mesmo valor próximos no tempo podem confundir — por isso a referência e o
  nome do convidado ficam visíveis em cada cota.
- **Confirmar errado:** não há "desconfirmar" cota na Sprint 5 (só presente entregue e compra pelo link).
  Se virar necessidade: cota confirmada → `expired` com trilha no fundo extra, na Sprint 6.
- **E-mail:** entregabilidade (SPF/DKIM do remetente) e custo ficam fora do núcleo; é opcional por isso.
- **Saldo extra é só anotação:** o dinheiro já está na conta do dono; o sistema não controla uso.

### ✅ Decisões confirmadas pelo time (revisão 10)

1. **"Recebi mesmo assim"** para cota vencida: cabendo → confirma no presente; não cabendo → fundo extra
   (com a migration `contribution_id`, já feita no Dia 1).
2. **E-mail ao dono:** indicador no app obrigatório + e-mail opcional por chave (ver interpretação na
   decisão 9 de desenho).
3. **Rate limit:** opção **A** (por slug no `/access`, por usuário nas rotas do dono) — Dia 5.
4. **Reverter "comprei pelo link"** apaga as linhas do fundo extra daquele presente.
5. **Fundo extra somente leitura** no v1 (sem "marcar como usado").

### ⚠️ Desvio detectado no código atual — senha de convidado em texto puro (**pendência em aberto**)

Ao receber o código atual (zip da revisão 10) apareceu uma mudança **fora deste planejamento** em
`events.service.ts` / `update-event.dto.ts`: a senha de convidado passou a ser **gravada e comparada em
texto puro** (`guestPasswordHash: dto.guestPassword`; `password === event.guestPasswordHash`), devolvida
ao dono em todas as respostas de evento (`guestPasswordHash` entrou em `PUBLIC_EVENT_FIELDS`) e editável
por um campo novo. A intenção parece ser **o dono poder ver a senha para compartilhar** — necessidade
legítima. O que isso custa:

- **Vazamento do banco expõe todas as senhas** (e donos costumam reaproveitar senhas). Backups e logs
  também carregam o texto puro.
- **Eventos já existentes** (criados com bcrypt) deixam de aceitar a senha certa: o valor gravado é um
  hash e a comparação agora é `===`. É preciso o dono **redefinir a senha** de cada um.
- O teste `EventsService › verifyGuestAccess › retorna o id e o título…` **falha** (espera bcrypt); o
  comentário "nunca inclui guestPasswordHash" ficou falso; o README ainda diz "senhas com hash".
- Sem o custo do bcrypt, tentar senhas fica mais barato — reforça a decisão 3 (limite por evento).

**Opções** (nenhuma foi aplicada; o código do time foi mantido como veio):
- **(A) Criptografia reversível** — grava a senha cifrada (AES-256-GCM, chave em variável de ambiente
  `GUEST_PASSWORD_KEY`), o dono continua vendo a senha, e um vazamento do banco **não** a expõe. Compara
  com `timingSafeEqual`. Exige a nova variável nos dois ambientes e migrar/redefinir as senhas antigas.
  **Recomendada** se o dono precisa ver a senha.
- **(B) Voltar ao bcrypt + "redefinir senha"** — o dono gera/escolhe uma nova senha e ela é mostrada
  **uma vez** (como fazem os apps de convite). Mais seguro, mas o dono não "revê" a senha depois.
- **(C) Manter texto puro** — aceitar o risco conscientemente (senha de acesso a uma lista de presentes,
  não credencial de conta) e ao menos: comparar com `timingSafeEqual`, trocar o nome da coluna/campo
  (`guestPasswordHash` engana) e atualizar testes/README.

> Pendente: escolher A, B ou C. Até lá a Sprint 5 segue normalmente — nada nas telas novas depende disso.

### Outras diferenças encontradas (informativas)

- Telas do convidado (`GuestGate`, `GiftClaim`, `GiftContribute`, `MyContributions`, `PixPaymentView`,
  `page.tsx`) e de login/cadastro/meus eventos **redesenhadas** com ícones; novo componente
  `ExpensiveGiftsCarousel`. A lógica das telas não mudou.
- `qrcode` / `@types/qrcode` instalados no frontend (necessários desde o Dia 2 da Sprint 4).
