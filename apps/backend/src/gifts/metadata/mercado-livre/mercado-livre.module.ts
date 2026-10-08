import { Module } from '@nestjs/common';
import { MercadoLivreAuthController } from './mercado-livre-auth.controller';
import { MercadoLivreService } from './mercado-livre.service';
import { MercadoLivreTokenService } from './mercado-livre-token.service';

@Module({
  controllers: [MercadoLivreAuthController],
  providers: [MercadoLivreTokenService, MercadoLivreService],
  exports: [MercadoLivreTokenService, MercadoLivreService],
})
export class MercadoLivreModule {}
