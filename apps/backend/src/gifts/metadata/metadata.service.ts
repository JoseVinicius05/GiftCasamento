import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { isAmazonShortLink } from './amazon/amazon-url';
import { AmazonExtractor } from './amazon/amazon.extractor';
import { AmazonShortLinkService } from './amazon/amazon-short-link.service';
import { MercadoLivreService } from './mercado-livre/mercado-livre.service';
import { detectStore } from './store-detector';
import { GiftPreview, MissingField, ProductMetadata } from './types/product-metadata';

// Códigos estáveis que o frontend usa pra mostrar a mensagem certa (diferente
// da mensagem de "a loja é suportada, mas algum campo não veio").
export const UNSUPPORTED_ECOMMERCE = 'UNSUPPORTED_ECOMMERCE';
export const SHORT_LINK_UNRESOLVED = 'SHORT_LINK_UNRESOLVED';

// Ponto de entrada único do auto-fetch de metadados: identifica a loja,
// delega pro extractor certo e devolve sempre o mesmo formato (GiftPreview).
@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private readonly mercadoLivre: MercadoLivreService,
    private readonly amazon: AmazonExtractor,
    private readonly amazonShortLink: AmazonShortLinkService,
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

    // Link encurtado da Amazon (a.co, amzn.to): vira o link completo ANTES de
    // buscar os dados. O link completo é o que fica salvo no presente.
    let resolvedUrl = url;
    if (store === 'amazon' && isAmazonShortLink(url)) {
      const full = await this.amazonShortLink.resolve(url);
      if (!full) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: SHORT_LINK_UNRESOLVED,
          message:
            'Não conseguimos abrir esse link encurtado. Abra o produto na Amazon, copie o ' +
            'endereço completo da barra do navegador e cole aqui — ou preencha manualmente.',
        });
      }
      resolvedUrl = full;
    }

    let metadata: ProductMetadata;
    try {
      metadata =
        store === 'mercadolivre'
          ? await this.mercadoLivre.fetchMetadata(resolvedUrl)
          : await this.amazon.extract(resolvedUrl);
    } catch (error) {
      // Os extractors já não deveriam lançar, mas esta é a última rede de
      // segurança: o preview nunca devolve 500 por falha de integração.
      this.logger.error(`Extractor de ${store} lançou exceção: ${(error as Error).message}`);
      metadata = { title: null, imageUrl: null, price: null, currency: null, source: null };
    }

    return { ...metadata, store, resolvedUrl, missingFields: this.findMissingFields(metadata) };
  }

  private findMissingFields(metadata: ProductMetadata): MissingField[] {
    const missing: MissingField[] = [];
    if (!metadata.title) missing.push('title');
    if (!metadata.imageUrl) missing.push('imageUrl');
    if (metadata.price === null) missing.push('price');
    return missing;
  }
}
