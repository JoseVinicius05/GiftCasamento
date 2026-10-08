import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { GiftsController } from './gifts.controller';
import { MetadataModule } from './metadata/metadata.module';

// Módulo de presentes. No Dia 3 só existe o preview; o CRUD (POST/GET/PATCH
// /events/:slug/gifts) entra no Dia 4, neste mesmo controller.
@Module({
  imports: [
    AuthModule, // JwtAuthGuard
    EventsModule, // EventsService (checagem de ownership do evento)
    MetadataModule, // MetadataService
    // Rate limit próprio do preview: 15 consultas por IP a cada 60s —
    // folgado pra uso humano, curto o bastante pra proteger a cota paga.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 15 }]),
  ],
  controllers: [GiftsController],
})
export class GiftsModule {}
