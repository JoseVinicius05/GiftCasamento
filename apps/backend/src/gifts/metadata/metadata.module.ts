import { Module } from '@nestjs/common';
import { AmazonExtractor } from './amazon/amazon.extractor';
import { AmazonShortLinkService } from './amazon/amazon-short-link.service';
import { BrightDataService } from './amazon/brightdata.service';
import { MercadoLivreModule } from './mercado-livre/mercado-livre.module';
import { MetadataService } from './metadata.service';
import { MicrolinkService } from './microlink/microlink.service';

// Junta as peças do auto-fetch: Mercado Livre (API oficial) e Amazon (Bright
// Data + fallback Microlink + resolução de links encurtados). O
// MetadataService é o único ponto de entrada usado pelo resto do backend
// (GiftsController).
@Module({
  imports: [MercadoLivreModule],
  providers: [
    BrightDataService,
    MicrolinkService,
    AmazonExtractor,
    AmazonShortLinkService,
    MetadataService,
  ],
  exports: [MetadataService],
})
export class MetadataModule {}
