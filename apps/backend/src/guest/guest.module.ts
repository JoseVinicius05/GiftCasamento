import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

// Lado do convidado (Sprint 4). Dia 1: leitura (evento + presentes).
// Dias 2–4: contribuir com cota, reivindicar presente, "minhas cotas".
@Module({
  imports: [AuthModule], // GuestAuthGuard / GuestSessionService
  controllers: [GuestController],
  providers: [GuestService],
})
export class GuestModule {}
