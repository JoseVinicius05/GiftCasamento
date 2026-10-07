import { Injectable, Logger } from '@nestjs/common';
import { MicrolinkService } from '../microlink/microlink.service';
import { ProductMetadata } from '../types/product-metadata';
import { BrightDataService } from './brightdata.service';

@Injectable()
export class AmazonExtractor {
  private readonly logger = new Logger(AmazonExtractor.name);

  constructor(
    private readonly brightData: BrightDataService,
    private readonly microlink: MicrolinkService,
  ) {}

  async extract(url: string): Promise<ProductMetadata> {
    const primary = await this.brightData.fetchProduct(url);

    const isComplete =
      primary !== null && primary.title !== null && primary.imageUrl !== null && primary.price !== null;

    if (isComplete) {
      return primary as ProductMetadata;
    }

    this.logger.log('Bright Data indisponível ou incompleta — complementando com Microlink.');
    const fallback = await this.microlink.fetchMetadata(url);

    // Nunca descarta o que a Bright Data já encontrou — só complementa o
    // que faltou, conforme a seção 4 do planejamento de scraping.
    return {
      title: primary?.title ?? fallback.title,
      imageUrl: primary?.imageUrl ?? fallback.imageUrl,
      price: primary?.price ?? fallback.price,
      currency: primary?.currency ?? fallback.currency,
      source: primary?.source ?? fallback.source,
    };
  }
}
