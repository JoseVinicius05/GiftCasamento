import { Injectable, Logger } from '@nestjs/common';
import { ProductMetadata } from '../types/product-metadata';

// "Products Global" (gd_lwhideng15g8jg63s7), não o "Products" padrão
// (gd_l7q7dkf244hwjntr0) — esse último só cobre amazon.com dos EUA.
// O WebGift precisa de amazon.com.br, então usamos o dataset que suporta
// qualquer domínio de país (amazon.{domínio}/dp/{ASIN}).
const DATASET_ID = 'gd_lwhideng15g8jg63s7';
const ENDPOINT = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${DATASET_ID}&format=json`;

// A documentação da Bright Data informa 10-30s de resposta síncrona pro
// scraper de produto — damos uma margem de segurança acima disso.
const TIMEOUT_MS = 35_000;

@Injectable()
export class BrightDataService {
  private readonly logger = new Logger(BrightDataService.name);

  // Retorna null em qualquer falha (chave ausente, timeout, erro da API) —
  // nunca lança exceção. Falha de integração externa não pode travar o
  // cadastro do presente, só cair no fallback (Microlink) ou no manual.
  async fetchProduct(url: string): Promise<ProductMetadata | null> {
    const apiKey = process.env.BRIGHTDATA_API_KEY;
    if (!apiKey) {
      this.logger.warn('BRIGHTDATA_API_KEY não configurada — pulando Bright Data.');
      return null;
    }

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ url }]),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`Bright Data retornou ${response.status} para a URL informada.`);
        return null;
      }

      const data = await response.json();
      const product = Array.isArray(data) ? data[0] : data;

      if (!product || product.error) {
        this.logger.warn('Bright Data não retornou um produto válido para essa URL.');
        return null;
      }

      return {
        title: product.title ?? null,
        imageUrl: product.image_url ?? null,
        price: typeof product.price === 'number' ? product.price : null,
        currency: product.currency ?? null,
        source: 'brightdata',
      };
    } catch (error) {
      this.logger.warn(`Erro ao chamar a Bright Data: ${(error as Error).message}`);
      return null;
    }
  }
}
