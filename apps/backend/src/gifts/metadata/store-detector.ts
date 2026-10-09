import { isAmazonShortLink } from './amazon/amazon-url';
import { SupportedStore } from './types/product-metadata';

// Decide de qual loja é a URL só olhando o HOSTNAME (nunca o caminho ou a
// query). Isso é também uma proteção: só URLs de domínios que a gente
// reconhece chegam nas integrações externas (Bright Data/Microlink), então
// ninguém consegue usar o endpoint de preview pra fazer um serviço pago
// buscar uma URL qualquer.
//
// Links encurtados:
// - Amazon (a.co, amzn.to, amzn.eu, amzn.asia): SUPORTADOS — o
//   MetadataService resolve o link completo antes de buscar os dados.
// - Mercado Livre (meli.la, mercadolivre.com/sec/...): NÃO suportados ainda;
//   o dono precisa colar o link completo do produto.
const MERCADO_LIVRE_HOST = /(^|\.)mercadolivre\.com\.br$/i;
const AMAZON_HOST = /(^|\.)amazon\.com(\.br)?$/i;

export function detectStore(rawUrl: string): SupportedStore | null {
  let hostname: string;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    hostname = url.hostname;
  } catch {
    return null;
  }

  if (MERCADO_LIVRE_HOST.test(hostname)) return 'mercadolivre';
  if (AMAZON_HOST.test(hostname) || isAmazonShortLink(rawUrl)) return 'amazon';
  return null;
}
