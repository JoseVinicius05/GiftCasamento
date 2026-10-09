import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';
import { MetadataModule } from './metadata/metadata.module';

// Módulo de presentes: preview de metadados (Dia 3) e CRUD do dono —
// POST/GET/PATCH /events/:slug/gifts (Dia 4). Excluir presente não está no
// planejamento do MVP.
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
  providers: [GiftsService],
})
export class GiftsModule {}
