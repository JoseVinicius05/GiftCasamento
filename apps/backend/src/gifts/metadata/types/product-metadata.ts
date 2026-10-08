// Formato único que todo o resto do backend consome — o GiftsService (Dia 4+)
// nunca precisa saber se o dado veio do Mercado Livre, da Bright Data ou do
// Microlink.
//
// Fontes possíveis:
// - 'mercadolivre-api': API oficial do ML, endpoint de CATÁLOGO (/products).
// - 'brightdata': integração principal da Amazon.
// - 'microlink': fallback técnico da Amazon (o ML NÃO usa Microlink — ele
//   devolve só o título/logo genérico do site, ver DOCUMENTACAO-TECNICA.md).
export type MetadataSource = 'mercadolivre-api' | 'brightdata' | 'microlink' | null;

export interface ProductMetadata {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  source: MetadataSource;
}

// Lojas com auto-fetch no MVP. Qualquer outra vira UNSUPPORTED_ECOMMERCE.
export type SupportedStore = 'mercadolivre' | 'amazon';

export type MissingField = 'title' | 'imageUrl' | 'price';

// O que o endpoint de preview devolve pro frontend: o ProductMetadata
// normalizado + qual loja foi identificada + quais campos o dono vai ter
// que preencher na mão. "missingFields" não é erro — é o caso normal
// (no Mercado Livre o preço SEMPRE aparece aqui).
export interface GiftPreview extends ProductMetadata {
  store: SupportedStore;
  missingFields: MissingField[];
}
