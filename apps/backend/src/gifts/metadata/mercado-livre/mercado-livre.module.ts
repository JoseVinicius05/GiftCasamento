import { Module } from '@nestjs/common';
import { MercadoLivreAuthController } from './mercado-livre-auth.controller';
import { MercadoLivreTokenService } from './mercado-livre-token.service';

@Module({
  controllers: [MercadoLivreAuthController],
  providers: [MercadoLivreTokenService],
  exports: [MercadoLivreTokenService],
})
export class MercadoLivreModule {}
