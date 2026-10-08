// Extrai os IDs de uma URL de produto do Mercado Livre.
//
// Existem DOIS tipos de ID que começam com "MLB", e confundir os dois foi o
// primeiro bug da integração (Sprint 3, Dia 1/2):
//
// - productId (catálogo): aparece em /.../p/MLB67008669. É o "produto" no
//   catálogo do ML, não um anúncio de vendedor. GET /items/{productId} dá
//   404 — o certo é GET /products/{productId}.
// - itemId (anúncio): aparece em ?wid=MLB5214413673 (links de recomendação),
//   ou em /MLB-123456789-titulo_JM (URLs clássicas de anúncio).
//
// Detalhe importante: nos links de recomendação do ML, o "wid" vem DEPOIS do
// "#" (fragmento), não do "?". Por isso lemos os dois lugares.

export interface MercadoLivreIds {
  productId: string | null;
  itemId: string | null;
}

export function parseMercadoLivreUrl(rawUrl: string): MercadoLivreIds {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { productId: null, itemId: null };
  }

  const productMatch = url.pathname.match(/\/p\/(MLB\d+)/i);
  const productId = productMatch ? productMatch[1].toUpperCase() : null;

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const wid = url.searchParams.get('wid') ?? hashParams.get('wid');

  let itemId: string | null = null;
  if (wid && /^MLB\d+$/i.test(wid)) {
    itemId = wid.toUpperCase();
  } else if (!productId) {
    // URL clássica de anúncio: /MLB-123456789-titulo_JM ou /MLB123456789.
    // Só olhamos isso se NÃO for página de catálogo, senão pegaríamos o
    // productId de novo achando que é um itemId.
    const classic = url.pathname.match(/MLB-?(\d+)/i);
    if (classic) itemId = `MLB${classic[1]}`;
  }

  return { productId, itemId };
}
