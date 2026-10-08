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
// No PowerShell, troque por: $env:NOME="valor"; node .\test-product-metadata.mjs "URL"

const url = process.argv[2];
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

function parseMercadoLivreUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }

  // product_id do catálogo (/.../p/MLB123...), quando existir — serve de fallback
  const prod = u.pathname.match(/\/p\/(MLB\d+)/i);
  const productId = prod ? prod[1].toUpperCase() : null;

  // 1) wid = item_id (anúncio exato que o usuário viu).
  // Nos links de recomendação do ML ele vem depois do '#', não do '?'.
  const hashParams = new URLSearchParams(u.hash.replace(/^#/, ''));
  const wid = u.searchParams.get('wid') ?? hashParams.get('wid');
  if (wid && /^MLB\d+$/i.test(wid)) {
    return { type: 'item', id: wid.toUpperCase(), productId };
  }

  // 2) Só catálogo: /p/MLB123 é product_id (NÃO é item_id)
  if (productId) return { type: 'product', id: productId, productId };

  // 3) Anúncio clássico: /MLB-123456-titulo_JM ou /MLB123456
  const item = u.pathname.match(/MLB-?(\d+)/i);
  if (item) return { type: 'item', id: `MLB${item[1]}`, productId: null };

  return null;
}

async function fetchMl(path, headers) {
  const res = await fetch(`https://api.mercadolibre.com${path}`, { headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  console.log(`GET ${path} -> status ${res.status}`);
  return { status: res.status, body };
}

async function testMercadoLivre() {
  const token = process.env.MERCADOLIVRE_ACCESS_TOKEN;
  if (!token) {
    console.log('\n--- Mercado Livre: pulado (MERCADOLIVRE_ACCESS_TOKEN não definida) ---');
    return;
  }
  console.log('\n--- Mercado Livre (API oficial) ---');

  const parsed = parseMercadoLivreUrl(url);
  if (!parsed) {
    console.log('Não consegui extrair nenhum ID dessa URL (esperava wid=MLB..., /p/MLB... ou /MLB-...).');
    return;
  }
  console.log(`ID extraído: ${parsed.id} (tipo: ${parsed.type})`);

  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'WebGiftCasamento-Dev/1.0 (teste manual da integracao)',
    Accept: 'application/json',
  };

  try {
    let result = null;

    if (parsed.type === 'item') {
      const { status, body } = await fetchMl(`/items/${parsed.id}`, headers);
      if (status === 200) {
        result = {
          title: body.title,
          image: body.pictures?.[0]?.url ?? body.thumbnail,
          price: body.price,
          currency: body.currency_id,
          source: 'items',
        };
      } else {
        console.log('Corpo completo da resposta:');
        console.log(JSON.stringify(body, null, 2));
      }
    }

    // Fallback (ou caminho principal para URLs de catálogo): /products/{id}
    if (!result) {
      const productId = parsed.productId;
      if (productId) {
        const { status, body } = await fetchMl(`/products/${productId}`, headers);
        if (status === 200) {
          const winner = body.buy_box_winner;
          // Debug temporário: descobrir onde (e se) o preço aparece nesta resposta
          console.log('  /products campos disponíveis:', Object.keys(body).join(', '));
          console.log('  buy_box_winner:', JSON.stringify(body.buy_box_winner ?? null));
          for (const k of Object.keys(body)) {
            if (/price|buy_box|offer/i.test(k) && k !== 'buy_box_winner') {
              console.log(`  ${k}:`, JSON.stringify(body[k]));
            }
          }
          result = {
            title: body.name,
            image: body.pictures?.[0]?.url,
            price: winner?.price ?? null,
            currency: winner?.currency_id ?? null,
            source: 'products',
          };
          if (!winner) {
            console.log('(produto sem buy_box_winner agora: título/imagem ok, preço indisponível)');
          }
        } else {
          console.log('Corpo completo da resposta:');
          console.log(JSON.stringify(body, null, 2));
        }
      }
    }


    if (!result) {
      console.log('\n--- Diagnóstico do 403/erro ---');
      // a) o token é válido e de quem? (/users/me exige token)
      const me = await fetchMl('/users/me', headers);
      console.log('  /users/me:', me.status === 200
        ? `ok (user ${me.body.id}, ${me.body.nickname})`
        : JSON.stringify(me.body));
      // b) o mesmo item SEM token (item público costuma abrir sem auth)
      const anon = await fetchMl(`/items/${parsed.id}`, {
        'User-Agent': headers['User-Agent'],
        Accept: 'application/json',
      });
      console.log('  /items sem token:', anon.status,
        anon.status === 200 ? `-> title: ${anon.body.title}, price: ${anon.body.price}` : JSON.stringify(anon.body));
      if (anon.status === 200) {
        result = {
          title: anon.body.title,
          image: anon.body.pictures?.[0]?.url ?? anon.body.thumbnail,
          price: anon.body.price,
          currency: anon.body.currency_id,
          source: 'items (sem token)',
        };
      }
    }

    console.log('\n=== RESULTADO FINAL (ML) ===');
    console.log(result ?? 'Nenhum dado obtido.');
  } catch (err) {
    console.error('Erro Mercado Livre:', err.message);
  }
}

await testMicrolink();
await testBrightData();
await testMercadoLivre();
