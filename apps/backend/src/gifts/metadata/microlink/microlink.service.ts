import { Injectable, Logger } from '@nestjs/common';
import { ProductMetadata } from '../types/product-metadata';

const ENDPOINT = 'https://api.microlink.io/';
const TIMEOUT_MS = 8_000;

@Injectable()
export class MicrolinkService {
  private readonly logger = new Logger(MicrolinkService.name);

  // Sempre retorna um ProductMetadata (nunca lança) — se der erro, volta
  // tudo null, que é o mesmo formato de "não achamos esse campo".
  async fetchMetadata(url: string): Promise<ProductMetadata> {
    const apiKey = process.env.MICROLINK_API_KEY;
    const endpoint = new URL(ENDPOINT);
    endpoint.searchParams.set('url', url);

    try {
      const response = await fetch(endpoint.toString(), {
        headers: apiKey ? { 'x-api-key': apiKey } : {},
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const json = await response.json();
      if (!response.ok || json.status !== 'success') {
        this.logger.warn(`Microlink não teve sucesso para a URL informada (status ${response.status}).`);
        return this.empty();
      }

      const data = json.data ?? {};

      // IMPORTANTE (débito técnico documentado, não escondido): o endpoint
      // padrão de metadados do Microlink extrai título/imagem/descrição via
      // Open Graph, mas NÃO garante um campo de preço estruturado — isso
      // exigiria configurar regras de "data extraction" (seletores CSS)
      // específicas pro layout de cada site, o que é trabalho de tuning
      // manual contra páginas reais (ver "Fase A — teste das integrações"
      // no planejamento). Por hora, só aproveitamos preço se vier de forma
      // direta no payload padrão; na prática, para a Amazon (onde o
      // Microlink é só fallback da Bright Data), é esperado que isso
      // frequentemente volte null — o que é um resultado aceitável e
      // previsto pelo próprio planejamento, não um bug.
      const price = typeof data.price === 'number' ? data.price : null;

      return {
        title: data.title ?? null,
        imageUrl: data.image?.url ?? null,
        price,
        currency: price !== null ? data.currency ?? 'BRL' : null,
        source: 'microlink',
      };
    } catch (error) {
      this.logger.warn(`Erro ao chamar o Microlink: ${(error as Error).message}`);
      return this.empty();
    }
  }

  private empty(): ProductMetadata {
    return { title: null, imageUrl: null, price: null, currency: null, source: null };
  }
}
