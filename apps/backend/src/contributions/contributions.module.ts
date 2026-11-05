import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';

// Cotas vistas pelo DONO (Sprint 5). Dia 1: leitura (lista + resumo).
// Dia 2: confirmar / rejeitar. Dia 3: fundo extra, presente entregue e
// reversão da compra pelo link.
@Module({
  imports: [
    AuthModule, // JwtAuthGuard
    EventsModule, // EventsService (checagem de ownership do evento)
  ],
  controllers: [ContributionsController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
