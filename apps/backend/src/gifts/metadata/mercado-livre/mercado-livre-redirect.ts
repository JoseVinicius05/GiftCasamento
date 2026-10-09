// Tenta descobrir o ID de catálogo (productId, /p/MLB...) de um anúncio
// quando a URL colada NÃO tem /p/MLB — por exemplo links clássicos
// /MLB-123456789-titulo_JM.
//
// Ideia: o site do Mercado Livre costuma redirecionar a página de um anúncio
// ligado a um produto de catálogo para a página /p/MLB... do catálogo. Então
// pedimos a página SEM seguir o redirect e lemos só o cabeçalho "Location".
// Não lemos o corpo da página (nada de scraping de HTML).
//
// SEGURANÇA: só pedimos URLs do domínio do Mercado Livre e só seguimos um
// redirect se o destino também for desse domínio.
//
// LIMITAÇÃO (honesta): isso depende de o ML responder a um cliente
// automatizado com um redirect de verdade. Se ele devolver uma página de
// verificação ou nenhum redirect, voltamos null e o dono preenche à mão.
const ML_HOST = /(^|\.)mercadolivre\.com\.br$/i;
const MAX_HOPS = 3;
const TIMEOUT_MS = 5_000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

export async function discoverCatalogId(startUrl: string): Promise<string | null> {
  let current = startUrl;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }

    if (!ML_HOST.test(parsed.hostname)) return null;

    const direct = parsed.pathname.match(/\/p\/(MLB\d+)/i);
    if (direct) return direct[1].toUpperCase();

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    try {
      await response.body?.cancel();
    } catch {
      // só liberando a conexão
    }

    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return null;

    try {
      current = new URL(location, current).toString();
    } catch {
      return null;
    }
  }

  return null;
}
