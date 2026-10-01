import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomSuffix, slugifyTitle } from './slug.util';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // Gera um slug único a partir do título, tipo "casamento-ana-joao-x7k2".
  // O dono nunca escolhe o slug manualmente — evita o retrabalho de "esse
  // endereço já existe, tenta outro", conforme decidido no planejamento.
  // Usado pelo POST /events, que entra no Dia 2.
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
