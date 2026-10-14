import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { GuestClaimsService } from './guest-claims.service';
import { GuestContributionsService } from './guest-contributions.service';
import { GuestMyContributionsService } from './guest-my-contributions.service';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

// Lado do convidado (Sprint 4). Dia 1: leitura (evento + presentes).
// Dia 2: reservar uma cota. Dia 3: presentear por completo (Pix ou link).
// Dia 4: "minhas contribuições" (listar, reabrir o Pix, cancelar).
@Module({
  imports: [
    AuthModule, // GuestAuthGuard / GuestSessionService
    // Rate limit da criação de cota: 20 por IP a cada 60s. Folgado pra um
    // convidado, mas num casamento muita gente divide o mesmo Wi-Fi (mesmo
    // IP) — por isso não é tão baixo quanto o do acesso por senha.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [GuestController],
  providers: [
    GuestService,
    GuestContributionsService,
    GuestClaimsService,
    GuestMyContributionsService,
  ],
})
export class GuestModule {}
