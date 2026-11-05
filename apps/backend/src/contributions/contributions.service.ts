import { Injectable } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { contributionEffectiveStatus, toCents } from '../gifts/gift-reservation.util';
import { PrismaService } from '../prisma.service';
import { toPixTxid } from '../pix/pix-payload';
import type { ContributionFilter } from './dto/list-contributions-query.dto';

// Ordem de exibição para o dono: o que pede ação primeiro (pendentes vivas),
// depois o que venceu (talvez o Pix tenha caído mesmo assim), por fim o
// histórico confirmado.
const GROUP_RANK: Record<string, number> = { pending: 0, expired: 1, confirmed: 2 };

function bucket() {
  return { count: 0, cents: 0 };
}

// Visão do DONO sobre as cotas do evento (somente leitura — Sprint 5, Dia 1).
// Confirmar/rejeitar chegam no Dia 2.
@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  // Lista as cotas do evento. 404 (nunca 403) se o evento não existe OU é de
  // outro dono — a checagem vem ANTES de qualquer leitura de cotas.
  async list(slug: string, ownerId: string, status?: ContributionFilter) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    const rows = await this.prisma.contribution.findMany({
      where: { gift: { eventId: event.id } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        giftId: true,
        guestDisplayName: true,
        amount: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        confirmedAt: true,
        gift: { select: { title: true, imageUrl: true } },
      },
    });

    const items = rows.map((row: any) => ({
      id: row.id,
      // Mesmo texto que vai no QR (txid): é o que o dono procura no extrato.
      reference: toPixTxid(row.id),
      giftId: row.giftId,
      giftTitle: row.gift.title,
      giftImageUrl: row.gift.imageUrl,
      guestName: row.guestDisplayName,
      amount: Number(row.amount),
      // EFETIVO: pendente com prazo vencido chega como 'expired'. O filtro
      // também usa o efetivo, por isso é feito aqui e não no banco.
      status: contributionEffectiveStatus(row.status, row.expiresAt) as ContributionFilter,
      createdAt: row.createdAt as Date,
      expiresAt: row.expiresAt as Date,
      confirmedAt: (row.confirmedAt ?? null) as Date | null,
    }));

    const filtered = status ? items.filter((item) => item.status === status) : items;

    return filtered.sort((a, b) => {
      const rank = GROUP_RANK[a.status] - GROUP_RANK[b.status];
      if (rank !== 0) return rank;

      if (a.status === 'pending') return a.expiresAt.getTime() - b.expiresAt.getTime(); // vence primeiro, no topo
      if (a.status === 'confirmed') {
        return (b.confirmedAt ?? b.createdAt).getTime() - (a.confirmedAt ?? a.createdAt).getTime();
      }
      return b.createdAt.getTime() - a.createdAt.getTime(); // vencidas: mais recentes primeiro
    });
  }

  // Totais do evento. Valores em reais; a soma é feita em centavos (sem erro de
  // ponto flutuante) e cada cota cai em UM só grupo (status efetivo) — não há
  // dupla contagem.
  async summary(slug: string, ownerId: string) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    const [rows, extra, giftsTotal, giftsPurchasedViaLink] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { gift: { eventId: event.id } },
        select: { status: true, amount: true, expiresAt: true },
      }),
      this.prisma.eventExtraFunds.aggregate({
        where: { eventId: event.id },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.gift.count({ where: { eventId: event.id } }),
      this.prisma.gift.count({ where: { eventId: event.id, status: 'purchased_via_link' } }),
    ]);

    const totals: Record<string, { count: number; cents: number }> = {
      pending: bucket(),
      expired: bucket(),
      confirmed: bucket(),
    };

    for (const row of rows as any[]) {
      const effective = contributionEffectiveStatus(row.status, row.expiresAt);
      const target = totals[effective];
      if (!target) continue;
      target.count += 1;
      target.cents += toCents(row.amount);
    }

    const toMoney = (b: { count: number; cents: number }) => ({ count: b.count, amount: b.cents / 100 });

    return {
      contributions: {
        confirmed: toMoney(totals.confirmed),
        pending: toMoney(totals.pending),
        expired: toMoney(totals.expired),
      },
      extraFunds: {
        count: extra._count?._all ?? 0,
        amount: toCents(extra._sum?.amount ?? 0) / 100,
      },
      gifts: { total: giftsTotal, purchasedViaLink: giftsPurchasedViaLink },
    };
  }
}
