import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    // Precisa do AuthModule pra ter acesso ao JwtAuthGuard usado no controller.
    AuthModule,
    // Rate limit próprio da rota de acesso do convidado: 10 tentativas por
    // IP a cada 60s. Registro separado do ThrottlerModule do login — são
    // contextos diferentes, cada um com sua própria contagem.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
