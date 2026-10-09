// Helpers puros (sem rede) para URLs da Amazon.

// Encurtadores oficiais da Amazon. Comparação por hostname EXATO — nunca
// "contém": "a.co.evil.com" e "evil.com/a.co" não podem passar.
const SHORT_HOSTS = new Set(['a.co', 'amzn.to', 'amzn.eu', 'amzn.asia']);

// Domínios onde um produto da Amazon realmente mora (Brasil e EUA, que são
// os que a Bright Data "Products Global" cobre pro nosso caso).
const PRODUCT_HOST = /(^|\.)amazon\.com(\.br)?$/i;

function parse(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function isAmazonShortLink(rawUrl: string): boolean {
  const url = parse(rawUrl);
  return url !== null && SHORT_HOSTS.has(url.hostname.toLowerCase());
}

export function isAmazonProductHost(hostname: string): boolean {
  return PRODUCT_HOST.test(hostname);
}

// ASIN = código de 10 caracteres do produto. Aparece em /dp/ASIN,
// /gp/product/ASIN e /gp/aw/d/ASIN.
export function extractAsin(rawUrl: string): string | null {
  const url = parse(rawUrl);
  if (!url) return null;
  const match = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

// Versão limpa do link: https://www.amazon.com.br/dp/ASIN — sem os
// parâmetros de rastreio que o a.co/amzn.to carregam. Devolve null se o
// destino não for um produto (ex: uma busca ou uma lista).
export function canonicalAmazonUrl(rawUrl: string): string | null {
  const url = parse(rawUrl);
  if (!url || !isAmazonProductHost(url.hostname)) return null;
  const asin = extractAsin(rawUrl);
  if (!asin) return null;
  const host = url.hostname.toLowerCase().endsWith('amazon.com.br')
    ? 'www.amazon.com.br'
    : 'www.amazon.com';
  return `https://${host}/dp/${asin}`;
}
