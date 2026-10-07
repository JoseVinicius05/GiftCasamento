// Formato único que todo o resto do backend consome — o GiftsService (Dia 3+)
// nunca precisa saber se o dado veio do Mercado Livre, da Bright Data ou do
// Microlink.
//
// Nota: o planejamento original previa só 'mercadolivre-api' | 'microlink'
// como fontes possíveis. Adicionei 'brightdata' porque ela passou a ser a
// integração PRINCIPAL da Amazon (não só um fallback do Microlink) — sem essa
// tag específica, a matriz de testes da seção 11 do planejamento de scraping
// ("Fonte principal / Fallback") não teria como distinguir as duas de verdade.
export type MetadataSource = 'mercadolivre-api' | 'brightdata' | 'microlink' | null;

export interface ProductMetadata {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  source: MetadataSource;
}
