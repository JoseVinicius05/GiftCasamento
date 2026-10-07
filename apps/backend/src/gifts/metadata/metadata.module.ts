import { Module } from '@nestjs/common';
import { AmazonExtractor } from './amazon/amazon.extractor';
import { BrightDataService } from './amazon/brightdata.service';
import { MercadoLivreModule } from './mercado-livre/mercado-livre.module';
import { MicrolinkService } from './microlink/microlink.service';

// Ainda sem MetadataService/controller próprios — isso entra no Dia 3,
// junto com o endpoint POST /events/:slug/gifts/preview. Por hoje (Dia 2),
// este módulo só junta as peças que já estão prontas: a conexão OAuth do
// Mercado Livre, e o pipeline da Amazon (Bright Data + Microlink).
@Module({
  imports: [MercadoLivreModule],
  providers: [BrightDataService, MicrolinkService, AmazonExtractor],
  exports: [MercadoLivreModule, AmazonExtractor],
})
export class MetadataModule {}
