#!/usr/bin/env node
// Teste isolado das integrações de metadados — NÃO depende do Nest rodando.
// Serve pra validar credenciais e ver o formato real de cada resposta antes
// de confiar nelas dentro do backend (Fase A do planejamento de scraping).
//
// Uso:
//   node test-product-metadata.mjs "URL_DO_PRODUTO"
//
// Mercado Livre (API oficial):
//   MERCADOLIVRE_ACCESS_TOKEN="..." node test-product-metadata.mjs "URL_DO_ML"
//   (token temporário de teste — a aplicação de verdade usa o
//   MercadoLivreTokenService com refresh automático, não isso)
//
// Bright Data (Amazon):
//   BRIGHTDATA_API_KEY="..." node test-product-metadata.mjs "URL_DA_AMAZON"
//
// Microlink (fallback):
//   MICROLINK_API_KEY="..." node test-product-metadata.mjs "URL_DA_AMAZON"
//
// Links encurtados da Amazon (a.co, amzn.to): o script mostra a cadeia de
// redirects e se a Amazon bloqueia a resolução a partir da SUA rede — o
// backend em produção (Render) pode se comportar diferente.
//
// Links do Mercado Livre sem /p/MLB: o script testa, nesta ordem, o catálogo,
// o multiget (/items?ids=) e a descoberta por redirect, e diz qual funcionou.
//
// No PowerShell, troque por: $env:NOME="valor"; node .\test-product-metadata.mjs "URL"

let url = process.argv[2];
if (!url) {
  console.error('Uso: node test-product-metadata.mjs "URL_DO_PRODUTO"');
  process.exit(1);
}

async function testMicrolink() {
  console.log('\n--- Microlink ---');
  const endpoint = new URL('https://api.microlink.io/');
  endpoint.searchParams.set('url', url);
  const headers = process.env.MICROLINK_API_KEY ? { 'x-api-key': process.env.MICROLINK_API_KEY } : {};

  try {
    const res = await fetch(endpoint, { headers });
    const json = await res.json();
    console.log('status HTTP:', res.status, '| status Microlink:', json.status);
    console.log('url final (depois dos redirects):', json.data?.url);
    console.log('title:', json.data?.title);
    console.log('image:', json.data?.image?.url);
    console.log('price (raw, se vier):', json.data?.price, json.data?.currency);
    if (json.data?.price === undefined) {
      console.log('(esperado: o endpoint padrão do Microlink raramente traz preço estruturado)');
    }
  } catch (err) {
    console.error('Erro Microlink:', err.message);
  }
}

async function testBrightData() {
  if (!process.env.BRIGHTDATA_API_KEY) {
    console.log('\n--- Bright Data: pulado (BRIGHTDATA_API_KEY não definida) ---');
    return;
  }
  console.log('\n--- Bright Data (Amazon, dataset "Products Global") ---');
  const datasetId = 'gd_lwhideng15g8jg63s7'; // cobre amazon.com.br, não só amazon.com
  const endpoint = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&format=json`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url }]),
    });
    const data = await res.json();
    console.log('status HTTP:', res.status, '(pode levar 10-30s, é normal)');
    console.log(JSON.stringify(Array.isArray(data) ? data[0] : data, null, 2));
  } catch (err) {
    console.error('Erro Bright Data:', err.message);
  }
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

const hostOf = (raw) => {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return '';
  }
};
const isMlHost = (h) => /(^|\.)mercadolivre\.com\.br$/.test(h);
const isAmazonShortHost = (h) => ['a.co', 'amzn.to', 'amzn.eu', 'amzn.asia'].includes(h);

// Segue redirects na mão, mostrando cada salto. Só entra em hosts permitidos.
async function followRedirects(startUrl, isAllowedHost, label) {
  let current = startUrl;
  for (let hop = 1; hop <= 4; hop++) {
    const host = hostOf(current);
    console.log(`  salto ${hop}: ${current}`);
    if (!isAllowedHost(host)) {
      console.log(`  (parei: "${host}" não é um host permitido para ${label})`);
      return current;
    }
    let res;
    try {
      res = await fetch(current, { redirect: 'manual', headers: BROWSER_HEADERS });
    } catch (err) {
      console.log('  falha de rede:', err.message);
      return null;
    }
    const location = res.headers.get('location');
    console.log(`  -> status ${res.status}${location ? ` | Location: ${location}` : ' | sem Location'}`);
    if (res.status < 300 || res.status >= 400 || !location) return current;
    current = new URL(location, current).toString();
  }
  return current;
}

// ---------------------------------------------------------------------------
// Amazon: link encurtado (a.co, amzn.to...)
// ---------------------------------------------------------------------------
async function testAmazonShortLink() {
  console.log('\n--- Amazon: link encurtado ---');
  const isAmazonProduct = (h) => /(^|\.)amazon\.com(\.br)?$/.test(h);
  const final = await followRedirects(url, (h) => isAmazonShortHost(h), 'encurtador da Amazon');

  if (final && isAmazonProduct(hostOf(final))) {
    const asin = new URL(final).pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)?.[1];
    console.log(
      asin
        ? `Resolvido pelo redirect direto. ASIN: ${asin}\nLink limpo: https://${hostOf(final).endsWith('.br') ? 'www.amazon.com.br' : 'www.amazon.com'}/dp/${asin.toUpperCase()}`
        : 'Chegou na Amazon, mas sem ASIN no caminho (não é uma página de produto).',
    );
    if (asin) url = final;
    return;
  }

  console.log(
    'O redirect direto NÃO resolveu a partir daqui. No backend, a camada 2 usa o Microlink ' +
      '(abre o link num navegador de verdade). Rode o teste do Microlink abaixo com MICROLINK_API_KEY ' +
      'e veja se o campo "url" final aparece.',
  );
}

// ---------------------------------------------------------------------------
// Mercado Livre
// ---------------------------------------------------------------------------
function parseMercadoLivreUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return { productId: null, itemId: null };
  }

  const prod = u.pathname.match(/\/p\/(MLB\d+)/i);
  const productId = prod ? prod[1].toUpperCase() : null;

  // Nos links de recomendação do ML o wid vem depois do '#', não do '?'.
  const hashParams = new URLSearchParams(u.hash.replace(/^#/, ''));
  const wid = u.searchParams.get('wid') ?? hashParams.get('wid');

  let itemId = null;
  if (wid && /^MLB\d+$/i.test(wid)) {
    itemId = wid.toUpperCase();
  } else if (!productId) {
    const classic = u.pathname.match(/MLB-?(\d+)/i);
    if (classic) itemId = `MLB${classic[1]}`;
  }
  return { productId, itemId };
}

async function fetchMl(path, headers) {
  const res = await fetch(`https://api.mercadolibre.com${path}`, { headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(`GET ${path} -> status ${res.status}`);
  return { status: res.status, body };
}

async function mlCatalog(productId, headers, label) {
  const { status, body } = await fetchMl(`/products/${productId}`, headers);
  if (status !== 200) {
    console.log('  corpo:', JSON.stringify(body));
    return null;
  }
  const winner = body.buy_box_winner;
  return {
    camada: label,
    title: body.name,
    image: body.pictures?.[0]?.url,
    price: winner?.price ?? null,
    currency: winner?.currency_id ?? null,
  };
}

async function testMercadoLivre() {
  const token = process.env.MERCADOLIVRE_ACCESS_TOKEN;
  if (!token) {
    console.log('\n--- Mercado Livre: pulado (MERCADOLIVRE_ACCESS_TOKEN não definida) ---');
    return;
  }
  console.log('\n--- Mercado Livre (API oficial) ---');

  const { productId, itemId } = parseMercadoLivreUrl(url);
  console.log(`productId (catálogo): ${productId ?? '—'} | itemId (anúncio): ${itemId ?? '—'}`);
  if (!productId && !itemId) {
    console.log('Nenhum ID MLB encontrado nessa URL.');
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'WebGiftCasamento-Dev/1.0 (teste manual da integracao)',
    Accept: 'application/json',
  };

  let result = null;

  // Camada 1: catálogo
  if (productId) {
    console.log('\n[camada 1] catálogo');
    result = await mlCatalog(productId, headers, '1 - catálogo');
  }

  // Camada 2: multiget pelo itemId
  if (!result && itemId) {
    console.log('\n[camada 2] multiget (/items?ids=)');
    const attrs = 'id,title,price,currency_id,pictures,thumbnail,catalog_product_id';
    const { status, body } = await fetchMl(`/items?ids=${itemId}&attributes=${attrs}`, headers);
    const entry = Array.isArray(body) ? body[0] : null;
    if (status === 200 && entry?.code === 200) {
      result = {
        camada: '2 - multiget',
        title: entry.body.title,
        image: entry.body.pictures?.[0]?.secure_url ?? entry.body.pictures?.[0]?.url ?? entry.body.thumbnail,
        price: entry.body.price ?? null,
        currency: entry.body.currency_id ?? null,
        catalog_product_id: entry.body.catalog_product_id ?? null,
      };
    } else {
      console.log('  corpo:', JSON.stringify(body));
    }
  }

  // Camada 3: descobrir o catálogo pelo redirect da página
  if (!result && !productId) {
    console.log('\n[camada 3] descoberta por redirect da página');
    const final = await followRedirects(url, isMlHost, 'Mercado Livre');
    const found = final && isMlHost(hostOf(final)) ? new URL(final).pathname.match(/\/p\/(MLB\d+)/i)?.[1] : null;
    if (found) {
      console.log(`  catálogo descoberto: ${found.toUpperCase()}`);
      result = await mlCatalog(found.toUpperCase(), headers, '3 - redirect + catálogo');
    } else {
      console.log('  o redirect não levou a uma página /p/MLB...');
    }
  }

  console.log('\n=== RESULTADO FINAL (ML) ===');
  console.log(
    result ??
      'Nenhuma camada trouxe dados — nesse caso o dono preenche tudo manualmente no formulário.',
  );
}

// ---------------------------------------------------------------------------
if (isAmazonShortHost(hostOf(url))) {
  await testAmazonShortLink();
}
await testMicrolink();
await testBrightData();
if (isMlHost(hostOf(url))) {
  await testMercadoLivre();
}
