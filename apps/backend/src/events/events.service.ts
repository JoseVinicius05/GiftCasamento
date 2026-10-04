import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
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

  // Usado tanto pelo GET quanto pelo PATCH de um evento específico.
  // Retorna 404 — nunca 403 — tanto se o slug não existe quanto se existe
  // mas pertence a outro dono. Isso evita que alguém descubra, por
  // tentativa e erro, quais slugs existem no sistema mas não são dele.
  async findBySlugForOwner(slug: string, ownerId: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { ...PUBLIC_EVENT_FIELDS, ownerId: true },
    });

    if (!event || event.ownerId !== ownerId) {
      throw new NotFoundException('Evento não encontrado');
    }

    const { ownerId: _ownerId, ...publicEvent } = event;
    return publicEvent;
  }

  async update(slug: string, dto: UpdateEventDto, ownerId: string) {
    // Garante ownership antes de editar — reaproveita a mesma checagem da leitura.
    await this.findBySlugForOwner(slug, ownerId);

    return this.prisma.event.update({
      where: { slug },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
        ...(dto.eventDate !== undefined && { eventDate: new Date(dto.eventDate) }),
        ...(dto.pixKey !== undefined && { pixKey: dto.pixKey }),
      },
      select: PUBLIC_EVENT_FIELDS,
    });
  }

  // Rota pública (sem JWT) — convidados não têm conta. Só confere a senha,
  // não gera sessão/token de convidado ainda (isso é a Sprint 4).
  async verifyGuestAccess(slug: string, password: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { guestPasswordHash: true },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    const isValid = await bcrypt.compare(password, event.guestPasswordHash);
    if (!isValid) {
      throw new UnauthorizedException('Senha incorreta');
    }

    return { valid: true };
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
