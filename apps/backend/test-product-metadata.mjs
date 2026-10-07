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

async function testMercadoLivre() {
  const token = process.env.MERCADOLIVRE_ACCESS_TOKEN;
  if (!token) {
    console.log('\n--- Mercado Livre: pulado (MERCADOLIVRE_ACCESS_TOKEN não definida) ---');
    return;
  }
  console.log('\n--- Mercado Livre (API oficial) ---');

  const match = url.match(/MLB-?(\d+)/i);
  if (!match) {
    console.log('Não consegui extrair o item_id dessa URL (esperava algo como "MLB1234567890").');
    return;
  }
  const itemId = `MLB${match[1]}`;

  try {
    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const item = await itemRes.json();
    console.log('GET /items status:', itemRes.status);
    console.log('title:', item.title);
    console.log('picture:', item.pictures?.[0]?.url);
    if (itemRes.status === 403) {
      console.log('403 esperado se o token estiver errado/expirado — confirma a necessidade do OAuth.');
    }

    const priceRes = await fetch(`https://api.mercadolibre.com/items/${itemId}/prices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const priceData = await priceRes.json();
    console.log('GET /items/:id/prices status:', priceRes.status);
    console.log(JSON.stringify(priceData, null, 2));
  } catch (err) {
    console.error('Erro Mercado Livre:', err.message);
  }
}

await testMicrolink();
await testBrightData();
await testMercadoLivre();
