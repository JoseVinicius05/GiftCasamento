import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { GuestSession } from '../auth/guest-session.service';
import { deriveGiftStatus, reservedByGift, toCents } from '../gifts/gift-reservation.util';
import { PrismaService } from '../prisma.service';
import { buildGuestPayment } from './guest-payment';

// "Minhas contribuições": o convidado enxerga e mexe SÓ nas cotas criadas pela
// própria sessão (guestSessionId = sid do token). O nome é auto-declarado e
// pode repetir, então nunca é usado pra decidir "de quem é a cota".
// Cota de outra sessão é "não encontrada" (404), igual a um id que não existe.

// Cota pendente cujo prazo passou já não segura valor (a regra de saldo a
// ignora), mesmo que o status gravado ainda diga "pending": é "expired".
function effectiveStatus(status: string, expiresAt: Date): string {
  return status === 'pending' && expiresAt.getTime() <= Date.now() ? 'expired' : status;
}

@Injectable()
export class GuestMyContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Mesmo tratamento das outras rotas do convidado: sessão de outro evento =
  // sessão inválida (o front volta pra tela de senha).
  private async findEventId(slug: string, guest: GuestSession): Promise<string> {
    const event = await this.prisma.event.findUnique({ where: { slug }, select: { id: true } });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }
    if (event.id !== guest.eventId) {
      throw new UnauthorizedException('Faça o acesso a este evento novamente');
    }
    return event.id;
  }

  // Lista (mais recente primeiro). Sem chave Pix: ela só sai ao reabrir o
  // pagamento de UMA cota pendente.
  async list(slug: string, guest: GuestSession) {
    const eventId = await this.findEventId(slug, guest);

    const rows = await this.prisma.contribution.findMany({
      where: { guestSessionId: guest.sid, gift: { eventId } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        giftId: true,
        amount: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        gift: { select: { title: true, imageUrl: true } },
      },
    });

    return rows.map((row: any) => ({
      id: row.id,
      giftId: row.giftId,
      giftTitle: row.gift.title,
      giftImageUrl: row.gift.imageUrl,
      amount: Number(row.amount),
      status: effectiveStatus(row.status, row.expiresAt),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    }));
  }

  // Reabre os dados de pagamento (chave + Copia e Cola regerado) de uma cota
  // PENDENTE e ainda dentro do prazo. Os dados aparecem uma vez ao reservar;
  // aqui o convidado recupera se fechou a tela.
  async getPayment(slug: string, contributionId: string, guest: GuestSession) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, pixKey: true, owner: { select: { name: true } } },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }
    if (event.id !== guest.eventId) {
      throw new UnauthorizedException('Faça o acesso a este evento novamente');
    }

    const contribution = await this.prisma.contribution.findFirst({
      where: { id: contributionId, guestSessionId: guest.sid, gift: { eventId: event.id } },
      select: {
        id: true,
        giftId: true,
        amount: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        gift: { select: { title: true } },
      },
    });

    if (!contribution) {
      throw new NotFoundException('Contribuição não encontrada');
    }

    const status = effectiveStatus(contribution.status, contribution.expiresAt);
    if (status !== 'pending') {
      throw new ConflictException({
        message:
          status === 'confirmed'
            ? 'Esta contribuição já foi confirmada pelos anfitriões — não há mais nada a pagar.'
            : 'Esta reserva expirou ou foi cancelada. Faça uma nova contribuição.',
        code: 'CONTRIBUTION_NOT_PAYABLE',
      });
    }

    return {
      contribution: {
        id: contribution.id,
        giftId: contribution.giftId,
        amount: Number(contribution.amount),
        status,
        createdAt: contribution.createdAt,
        expiresAt: contribution.expiresAt,
      },
      gift: { id: contribution.giftId, title: contribution.gift.title },
      payment: buildGuestPayment(event, contribution),
    };
  }

  // Cancela a PRÓPRIA cota pendente: vira `expired` na hora (decisão do time:
  // reaproveitar `expired`, sem status novo) e o valor volta a ficar disponível.
  //
  // Trava a linha do presente, como a criação de cota e o "comprei pelo link":
  // assim o cancelamento nunca se mistura com outra operação no mesmo
  // presente, e o status gravado do presente é recalculado sobre o saldo certo.
  async cancel(slug: string, contributionId: string, guest: GuestSession) {
    const eventId = await this.findEventId(slug, guest);

    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1) Descobre o presente a travar (só se a cota for desta sessão e deste evento).
        const mine = await tx.contribution.findFirst({
          where: { id: contributionId, guestSessionId: guest.sid, gift: { eventId } },
          select: { giftId: true },
        });
        if (!mine) {
          throw new NotFoundException('Contribuição não encontrada');
        }

        // 2) Trava e SÓ DEPOIS relê: entre o passo 1 e o lock, a cota pode ter
        //    mudado (ex.: o dono confirmou o recebimento — Sprint 5).
        await tx.$queryRaw`SELECT "id" FROM "gifts" WHERE "id" = ${mine.giftId} FOR UPDATE`;

        const contribution = await tx.contribution.findUnique({
          where: { id: contributionId },
          select: { status: true, expiresAt: true },
        });
        const status = contribution ? effectiveStatus(contribution.status, contribution.expiresAt) : 'expired';

        if (!contribution || status !== 'pending') {
          throw new ConflictException({
            message:
              status === 'confirmed'
                ? 'Esta contribuição já foi confirmada pelos anfitriões e não pode ser cancelada.'
                : 'Esta reserva já expirou ou foi cancelada.',
            code: 'CONTRIBUTION_NOT_CANCELLABLE',
          });
        }

        // 3) Cancela: expired agora.
        await tx.contribution.update({
          where: { id: contributionId },
          data: { status: 'expired', expiresAt: new Date() },
        });

        // 4) Recalcula o status GRAVADO do presente sobre o saldo sem esta cota
        //    (presente comprado pelo link / confirmado nunca muda aqui).
        const gift = await tx.gift.findUnique({ where: { id: mine.giftId } });
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
      contribution: { id: contributionId, status: 'expired' },
      gift: {
        id: result.gift.id,
        title: result.gift.title,
        status: result.giftStatus,
        reservedAmount: result.reserved,
        availableAmount: result.availableCents / 100,
      },
    };
  }
}
