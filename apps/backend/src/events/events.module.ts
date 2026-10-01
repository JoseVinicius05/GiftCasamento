import { Module } from '@nestjs/common';
import { EventsService } from './events.service';

// Ainda sem controller: o Dia 1 só pede a geração do slug único.
// POST /events (e o resto do CRUD) entra no Dia 2.
@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
