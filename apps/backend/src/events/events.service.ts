import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { randomSuffix, slugifyTitle } from './slug.util';

const MAX_SLUG_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

// Nunca inclui guestPasswordHash — essa é a única senha que sai do banco
// pra fora em qualquer resposta deste serviço.
const PUBLIC_EVENT_FIELDS = {
  id: true,
  title: true,
  eventType: true,
  eventDate: true,
  slug: true,
  pixKey: true,
  createdAt: true,
} as const;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEventDto, ownerId: string) {
    const slug = await this.generateUniqueSlug(dto.title);
    const guestPasswordHash = await bcrypt.hash(dto.guestPassword, BCRYPT_ROUNDS);

    return this.prisma.event.create({
      data: {
        ownerId,
        title: dto.title,
        eventType: dto.eventType,
        eventDate: new Date(dto.eventDate),
        slug,
        guestPasswordHash,
        pixKey: dto.pixKey,
      },
      select: PUBLIC_EVENT_FIELDS,
    });
  }

  async findAllByOwner(ownerId: string) {
    return this.prisma.event.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_EVENT_FIELDS,
    });
  }

  // Gera um slug único a partir do título, tipo "casamento-ana-joao-x7k2".
  // O dono nunca escolhe o slug manualmente — evita o retrabalho de "esse
  // endereço já existe, tenta outro", conforme decidido no planejamento.
  async generateUniqueSlug(title: string): Promise<string> {
    const base = slugifyTitle(title) || 'evento';

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidate = `${base}-${randomSuffix()}`;
      const existing = await this.prisma.event.findUnique({ where: { slug: candidate } });
      if (!existing) {
        return candidate;
      }
    }

    // Sufixo de 5 caracteres em base36 (~60 milhões de combinações possíveis):
    // colidir 5 vezes seguidas pro mesmo título é praticamente impossível.
    // Se acontecer de verdade, é sinal de outro bug, não só má sorte.
    throw new Error('Não foi possível gerar um slug único para este título.');
  }
}
