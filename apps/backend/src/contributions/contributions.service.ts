import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import {
  contributionEffectiveStatus,
  deriveGiftStatus,
  isTerminalGiftStatus,
  reservedByGift,
  toCents,
} from '../gifts/gift-reservation.util';
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

// Visão do DONO sobre as cotas do evento. Dia 1: leitura (lista + resumo).
// Dia 2: confirmar ("Recebi" / "Recebi mesmo assim") e rejeitar ("Não recebi").
//
// Toda escrita segue o mesmo padrão das cotas do convidado: ownership (404) →
// transação → TRAVA a linha do presente → RELÊ a cota → decide → grava. A
// trava é a mesma de criar cota, "comprei pelo link" e cancelar: nenhuma
// dessas operações roda ao mesmo tempo no mesmo presente.
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
        // Só o id: serve para saber se o valor desta cota já foi lançado no
        // fundo extra (e, com isso, não oferecer confirmar de novo).
        extraFund: { select: { id: true } },
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
      // true = o valor desta cota está no saldo extra (Pix tardio que não cabia
      // no presente, ou cota confirmada num presente já comprado pelo link).
      inExtraFunds: Boolean(row.extraFund),
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

  // ---------------------------------------------------------------------------
  // Dia 2 — confirmar / rejeitar
  // ---------------------------------------------------------------------------

  // Acha a cota DO EVENTO do dono (nunca de outro) e devolve o presente a travar.
  private async findOwnContribution(tx: any, eventId: string, contributionId: string) {
    const mine = await tx.contribution.findFirst({
      where: { id: contributionId, gift: { eventId } },
      select: { giftId: true },
    });
    if (!mine) {
      throw new NotFoundException('Cota não encontrada');
    }
    return mine.giftId as string;
  }

  // "Recebi": o dono confirma que o Pix caiu.
  //
  //  1. pendente DENTRO do prazo → confirmed + confirmedAt; o presente passa a
  //     contar o valor como confirmado.
  //  2. vencida/cancelada → exige `acceptExpired` (409 CONTRIBUTION_EXPIRED sem
  //     ele). Se o presente AINDA comporta o valor → vira confirmed e conta nele;
  //     se NÃO comporta (outros já cobriram, ou foi comprado) → o valor vai para
  //     o fundo extra e a cota continua `expired`. Um Pix tardio nunca estoura o
  //     preço do presente.
  //  3. presente já comprado pelo link (ou entregue) → a cota vira confirmed e o
  //     valor vai para o fundo extra, na mesma transação.
  //
  // Idempotente: a cota que já está confirmed, ou cujo valor já foi lançado no
  // fundo extra, responde 409 ALREADY_CONFIRMED — e `contribution_id` é único,
  // então nem uma corrida consegue gerar duas linhas do fundo extra.
  async confirm(slug: string, ownerId: string, contributionId: string, acceptExpired = false) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1) Descobre o presente a travar (só se a cota for deste evento).
        const giftId = await this.findOwnContribution(tx, event.id, contributionId);

        // 2) Trava e SÓ DEPOIS relê: entre o passo 1 e o lock, a cota pode ter
        //    mudado (o convidado cancelou, o dono confirmou em outra aba...).
        await tx.$queryRaw`SELECT "id" FROM "gifts" WHERE "id" = ${giftId} AND "event_id" = ${event.id} FOR UPDATE`;

        const contribution = await tx.contribution.findUnique({
          where: { id: contributionId },
          select: {
            id: true,
            amount: true,
            status: true,
            expiresAt: true,
            guestDisplayName: true,
            extraFund: { select: { id: true } },
          },
        });
        if (!contribution) {
          throw new NotFoundException('Cota não encontrada');
        }

        const effective = contributionEffectiveStatus(contribution.status, contribution.expiresAt);

        if (effective === 'confirmed' || contribution.extraFund) {
          throw new ConflictException({
            message:
              effective === 'confirmed'
                ? 'Esta cota já foi confirmada.'
                : 'O valor desta cota já foi lançado no saldo extra.',
            code: 'ALREADY_CONFIRMED',
          });
        }

        if (effective === 'expired' && !acceptExpired) {
          throw new ConflictException({
            message:
              'Esta reserva venceu ou foi cancelada. Se o Pix caiu mesmo assim, confirme com "Recebi mesmo assim".',
            code: 'CONTRIBUTION_EXPIRED',
          });
        }

        const gift = await tx.gift.findUnique({ where: { id: giftId } });
        if (!gift) {
          throw new NotFoundException('Presente não encontrado');
        }

        const amountCents = toCents(contribution.amount);
        const now = new Date();

        // Decide para onde o dinheiro vai.
        //  - presente fechado (comprado pelo link / entregue): fundo extra e a cota fica confirmed;
        //  - vencida e o valor não cabe mais: fundo extra e a cota segue expired;
        //  - senão: entra no presente.
        let toExtraFunds = false;
        let finalStatus: 'confirmed' | 'expired' = 'confirmed';

        if (isTerminalGiftStatus(gift.status)) {
          toExtraFunds = true;
        } else if (effective === 'expired') {
          // Cota vencida não entra no reservado (a regra de saldo a ignora), então
          // o disponível já é o que sobra SEM ela.
          const reservedCents = toCents((await reservedByGift(tx, [gift.id])).get(gift.id) ?? 0);
          const availableCents = Math.max(0, toCents(gift.price) - reservedCents);
          if (amountCents > availableCents) {
            toExtraFunds = true;
            finalStatus = 'expired';
          }
        }

        if (finalStatus === 'confirmed') {
          await tx.contribution.update({
            where: { id: contributionId },
            data: { status: 'confirmed', confirmedAt: now },
          });
        }

        if (toExtraFunds) {
          await tx.eventExtraFunds.create({
            data: {
              eventId: event.id,
              amount: contribution.amount,
              sourceGiftId: gift.id,
              contributionId: contribution.id,
              note: this.extraFundNote(contribution.guestDisplayName, gift, effective === 'expired'),
            },
          });
        }

        // Recalcula o status GRAVADO do presente sobre o saldo já com a decisão
        // aplicada (terminais nunca mudam aqui — deriveGiftStatus os preserva).
        const reserved = (await reservedByGift(tx, [gift.id])).get(gift.id) ?? 0;
        const giftStatus = deriveGiftStatus(gift.status, gift.price, reserved);
        if (giftStatus !== gift.status) {
          await tx.gift.update({ where: { id: gift.id }, data: { status: giftStatus as any } });
        }

        const availableCents = Math.max(0, toCents(gift.price) - toCents(reserved));
        return {
          gift,
          giftStatus,
          reserved,
          availableCents,
          finalStatus,
          toExtraFunds,
          amount: Number(contribution.amount),
          confirmedAt: finalStatus === 'confirmed' ? now : null,
        };
      },
      { maxWait: 5_000, timeout: 10_000 },
    );

    return {
      // applied = o valor passou a contar no presente; extra_funds = foi para o saldo extra.
      outcome: result.toExtraFunds ? ('extra_funds' as const) : ('applied' as const),
      contribution: {
        id: contributionId,
        status: result.finalStatus,
        confirmedAt: result.confirmedAt,
      },
      extraFund: result.toExtraFunds ? { amount: result.amount } : null,
      gift: {
        id: result.gift.id,
        title: result.gift.title,
        status: result.giftStatus,
        reservedAmount: result.reserved,
        availableAmount: result.availableCents / 100,
      },
    };
  }

  // "Não recebi": a cota pendente vira `expired` na hora (reaproveita `expired`,
  // como o cancelamento do convidado) e o valor volta a ficar disponível.
  //
  // Já confirmada → 409 ALREADY_CONFIRMED (não existe "desconfirmar" na Sprint 5).
  // Já expirada/cancelada → 409 ALREADY_EXPIRED. Pendente com prazo vencido, mas
  // ainda gravada como pending, é encerrada normalmente (só arruma o registro).
  async reject(slug: string, ownerId: string, contributionId: string) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const giftId = await this.findOwnContribution(tx, event.id, contributionId);

        await tx.$queryRaw`SELECT "id" FROM "gifts" WHERE "id" = ${giftId} AND "event_id" = ${event.id} FOR UPDATE`;

        const contribution = await tx.contribution.findUnique({
          where: { id: contributionId },
          select: { status: true, expiresAt: true },
        });
        if (!contribution) {
          throw new NotFoundException('Cota não encontrada');
        }

        if (contribution.status === 'confirmed') {
          throw new ConflictException({
            message: 'Esta cota já foi confirmada e não pode ser rejeitada.',
            code: 'ALREADY_CONFIRMED',
          });
        }
        if (contribution.status !== 'pending') {
          throw new ConflictException({
            message: 'Esta cota já está vencida ou cancelada.',
            code: 'ALREADY_EXPIRED',
          });
        }

        // Não "rejuvenesce" o prazo: se já passou, mantém; se não, encerra agora.
        const now = new Date();
        await tx.contribution.update({
          where: { id: contributionId },
          data: {
            status: 'expired',
            expiresAt: contribution.expiresAt.getTime() > now.getTime() ? now : contribution.expiresAt,
          },
        });

        const gift = await tx.gift.findUnique({ where: { id: giftId } });
        if (!gift) {
          throw new NotFoundException('Presente não encontrado');
        }

        const reserved = (await reservedByGift(tx, [gift.id])).get(gift.id) ?? 0;
        const giftStatus = deriveGiftStatus(gift.status, gift.price, reserved);
        if (giftStatus !== gift.status) {
          await tx.gift.update({ where: { id: gift.id }, data: { status: giftStatus as any } });
        }

        const availableCents = Math.max(0, toCents(gift.price) - toCents(reserved));
        return { gift, giftStatus, reserved, availableCents };
      },
      { maxWait: 5_000, timeout: 10_000 },
    );

    return {
      contribution: { id: contributionId, status: 'expired' as const },
      gift: {
        id: result.gift.id,
        title: result.gift.title,
        status: result.giftStatus,
        reservedAmount: result.reserved,
        availableAmount: result.availableCents / 100,
      },
    };
  }

  // Nota que o dono lê no saldo extra: de quem é o valor e por que está lá.
  private extraFundNote(
    guestName: string,
    gift: { title: string; status: string; purchasedViaLinkBy?: string | null },
    wasExpired: boolean,
  ): string {
    const base = `Cota de ${guestName} em "${gift.title}"`;
    if (isTerminalGiftStatus(gift.status)) {
      const buyer = gift.purchasedViaLinkBy ? ` por ${gift.purchasedViaLinkBy}` : '';
      return gift.status === 'purchased_via_link'
        ? `${base} — confirmada depois que o presente foi comprado pelo link${buyer}`
        : `${base} — confirmada depois que o presente foi entregue`;
    }
    return wasExpired
      ? `${base} — Pix recebido após o vencimento, quando o presente já estava coberto`
      : base;
  }
}
