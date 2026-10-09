# Sistema de Lista de Presentes por Evento — Planejamento MVP

> **Revisão 4 — fechamento do Dia 4 da Sprint 3** (revisão 3: Dia 3).
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
| 3 | Cadastro de presentes + modelo de cotas | Formulário de presente (metadados + fallback manual), preço-alvo, schema de Contribution/EventExtraFunds | 🔄 em andamento (Dias 1–4 ✅) |
| 4 | Acesso do convidado + reivindicação (completa e por cota) | Login de evento, nome, reivindicar completo ou cota, reserva atômica e expiração de 48h | — |
| 5 | Pagamento manual + confirmação + saldo extra | Painel de confirmação, `EventExtraFunds`, e-mail/notificação simples | — |
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
- [ ] Tudo testado em produção
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
- 🆕 **Excluir presente:** não está no planejamento do MVP. O dono hoje só consegue editar. Decidir
  se entra (e como tratar presente que já tem cotas).
- 🆕 **Links encurtados do ML** (`meli.la`): resolver com a mesma técnica ou continuar pedindo o
  link completo?
- **Preço automático do Mercado Livre:** inviável pelo catálogo. Só viria do multiget, se
  funcionar. Caso contrário, aceitar o preço manual como definitivo.
- Nome/domínio do produto ("WebGift" ainda não confirmado).
- Página pública do convidado, ainda mockada (Sprint 4).
