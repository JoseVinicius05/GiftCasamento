import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { AmazonExtractor } from './amazon/amazon.extractor';
import { MercadoLivreService } from './mercado-livre/mercado-livre.service';
import { detectStore } from './store-detector';
import { GiftPreview, MissingField, ProductMetadata } from './types/product-metadata';

// Código estável que o frontend usa pra mostrar a mensagem certa (diferente
// da mensagem de "a loja é suportada, mas algum campo não veio").
export const UNSUPPORTED_ECOMMERCE = 'UNSUPPORTED_ECOMMERCE';

// Ponto de entrada único do auto-fetch de metadados: identifica a loja,
// delega pro extractor certo e devolve sempre o mesmo formato (GiftPreview).
@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private readonly mercadoLivre: MercadoLivreService,
    private readonly amazon: AmazonExtractor,
  ) {}

  async preview(url: string): Promise<GiftPreview> {
    const store = detectStore(url);

    if (!store) {
      // 422 com "code" próprio: é um erro "esperado" (loja fora do escopo do
      // MVP), não uma falha. O frontend troca o formulário pro modo manual.
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: UNSUPPORTED_ECOMMERCE,
        message:
          'E-commerce não suportado. Por enquanto só Mercado Livre e Amazon têm preenchimento ' +
          'automático — preencha os dados do presente manualmente.',
      });
    }

    let metadata: ProductMetadata;
    try {
      metadata =
        store === 'mercadolivre'
          ? await this.mercadoLivre.fetchMetadata(url)
          : await this.amazon.extract(url);
    } catch (error) {
      // Os extractors já não deveriam lançar, mas esta é a última rede de
      // segurança: o preview nunca devolve 500 por falha de integração.
      this.logger.error(`Extractor de ${store} lançou exceção: ${(error as Error).message}`);
      metadata = { title: null, imageUrl: null, price: null, currency: null, source: null };
    }

    return { ...metadata, store, missingFields: this.findMissingFields(metadata) };
  }

  private findMissingFields(metadata: ProductMetadata): MissingField[] {
    const missing: MissingField[] = [];
    if (!metadata.title) missing.push('title');
    if (!metadata.imageUrl) missing.push('imageUrl');
    if (metadata.price === null) missing.push('price');
    return missing;
  }
}
