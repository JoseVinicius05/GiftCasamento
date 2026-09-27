@AGENTS.md

# Contexto do Projeto — Sistema de Lista de Presentes por Evento

## O que é

Sistema onde um usuário cria um evento (ex: casamento) e adiciona presentes através de links de produtos de e-commerce. O sistema tenta buscar automaticamente metadados do link (título, imagem, preço) para preencher o cadastro do presente. Convidados acessam o evento via link + senha compartilhados (sem criar conta), reivindicam presentes e seguem para a compra fora da plataforma.

**Princípio central: o sistema nunca processa/custodia dinheiro.** Isso é uma decisão deliberada para evitar compliance de pagamento (regulação do Bacen, PSD2/PCI, necessidade de CNPJ e KYC) no MVP. Qualquer sugestão de código que envolva guardar cartão, processar Pix via API, ou custodiar valores deve ser sinalizada como mudança de escopo, não implementada silenciosamente.

## Decisões de escopo do MVP (v1) — não expandir sem confirmar com o time

- ❌ Sem contribuição parcial / vaquinha em presente (presente é reivindicado por 1 convidado só)
- ❌ Sem gateway de pagamento — confirmação de "recebido" é manual, feita pelo dono do evento no painel
- ❌ Sem conta de convidado — acesso via link+senha do evento; nome do convidado é auto-declarado (não verificado) no primeiro acesso, e gera um token de sessão
- ✅ Cadastro de presente é assistido: sistema tenta buscar metadados via serviço de link-preview (ex: Microlink/LinkPreview), preenche o que conseguir, e sempre permite edição/preenchimento manual dos campos que faltarem (preço nem sempre vem nos metadados de todo e-commerce)

## Stack

- **Frontend**: Next.js
- **Backend**: Nest.js
- **Banco de dados**: PostgreSQL
- **Hosting (proposto)**: Vercel (front) + Railway/Render (back) + Neon (Postgres) — prioriza simplicidade de deploy, já que o time está aprendendo a stack

## Modelo de dados (visão geral — ver schema completo no planejamento)

- `User`: dono do evento
- `Event`: pertence a um User; tem slug, senha de convidado (hash), modo de pagamento (`redirect_link` ou `pix_key`)
- `Gift`: pertence a um Event; tem status (`available` / `claimed` / `confirmed`)
- `GiftClaim`: liga um Gift a um convidado (nome auto-declarado + token de sessão)

**Regra crítica de concorrência**: a transição de status `available → claimed` em `Gift` precisa ser atômica (transação/lock no banco) para evitar que dois convidados reivindiquem o mesmo presente simultaneamente. Qualquer implementação desse fluxo deve ser revisada com isso em mente.

## Como ajudar como assistente de IA neste projeto

- Time de 4 pessoas, nenhuma com experiência prévia em Next.js/Nest.js (mas já programaram outros backends antes). Priorize clareza e explicação sobre esperteza/abstrações avançadas — código que o time consiga entender e debugar sozinho depois é mais valioso que código "elegante".
- Prazo apertado (6 semanas, ver plano de sprints). Evite sugerir refatorações grandes ou introduzir dependências novas sem necessidade clara.
- Antes de implementar qualquer fluxo de pagamento além do que está descrito acima, pare e pergunte — é a área de maior risco de compliance do projeto.
- Sprint 6 é buffer, não é para features novas — se estiver ajudando a planejar trabalho para a sprint 6, priorize correção de bugs e polimento, não escopo novo.


