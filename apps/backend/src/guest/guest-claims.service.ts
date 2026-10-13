import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { GuestSession } from '../auth/guest-session.service';
import { isTerminalGiftStatus, reservedByGift, toCents } from '../gifts/gift-reservation.util';
import { PrismaService } from '../prisma.service';
import { GuestContributionsService } from './guest-contributions.service';

// "Presentear por completo": o convidado leva o presente inteiro (ou o que
// falta dele) de um de dois jeitos.
@Injectable()
export class GuestClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contributionsService: GuestContributionsService,
  ) {}

  async claim(slug: string, giftId: string, guest: GuestSession, method: 'pix' | 'link') {
    if (method === 'pix') {
      // Pix integral = uma cota do valor que ainda está disponível. Reaproveita
      // a MESMA transação, regras, Copia e Cola e prazo de 48h das cotas.
      const result = await this.contributionsService.create(slug, giftId, guest, 'remaining');
      return { method: 'pix' as const, ...result };
    }

    return this.claimByLink(slug, giftId, guest);
  }

  // "Comprei pelo link da loja": fecha o presente (purchased_via_link).
  //
  // Se o presente já tinha cotas CONFIRMADAS (o Pix delas já caiu na conta do
  // dono), esse dinheiro sobrou — ninguém mais vai precisar dele pra este
  // presente. Cada cota confirmada vira uma linha do fundo extra
  // (EventExtraFunds), tudo na mesma transação que fecha o presente: ou
  // acontece tudo, ou nada. Cotas PENDENTES não são tocadas (ver planejamento,
  // seção 10): se o dono confirmar uma depois, o valor vai pro fundo extra na
  // Sprint 5; se ninguém pagou, expiram sozinhas.
  private async claimByLink(slug: string, giftId: string, guest: GuestSession) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.id !== guest.eventId) {
      throw new UnauthorizedException('Faça o acesso a este evento novamente');
    }

    const gift = await this.prisma.$transaction(
      async (tx) => {
        // Mesmo lock da criação de cota: link e cotas no mesmo presente nunca
        // rodam juntos — um espera o outro terminar.
        await tx.$queryRaw`SELECT "id" FROM "gifts" WHERE "id" = ${giftId} AND "event_id" = ${event.id} FOR UPDATE`;

        const gift = await tx.gift.findFirst({ where: { id: giftId, eventId: event.id } });
        if (!gift) {
          throw new NotFoundException('Presente não encontrado');
        }

        if (isTerminalGiftStatus(gift.status)) {
          throw new ConflictException({
            message: 'Este presente já foi garantido por outro convidado.',
            code: 'GIFT_UNAVAILABLE',
          });
        }

        if (!gift.productUrl) {
          throw new BadRequestException({
            message: 'Este presente não tem link de compra. Use o Pix.',
            code: 'NO_PRODUCT_URL',
          });
        }

        // Sem saldo (tudo já reservado por cotas vivas): o presente já está
        // garantido, não faz sentido comprá-lo de novo. fully_funded gravado
        // pode estar velho — quem decide é o saldo calculado agora.
        const reservedCents = toCents((await reservedByGift(tx, [gift.id])).get(gift.id) ?? 0);
        if (toCents(gift.price) - reservedCents <= 0) {
          throw new ConflictException({
            message: 'Este presente já foi totalmente reservado por outros convidados.',
            code: 'GIFT_UNAVAILABLE',
          });
        }

        const confirmed = await tx.contribution.findMany({
          where: { giftId: gift.id, status: 'confirmed' },
          select: { amount: true, guestDisplayName: true },
        });

        if (confirmed.length > 0) {
          await tx.eventExtraFunds.createMany({
            data: confirmed.map((contribution) => ({
              eventId: event.id,
              amount: contribution.amount,
              sourceGiftId: gift.id,
              note: `Cota de ${contribution.guestDisplayName} em "${gift.title}" — presente comprado pelo link por ${guest.name}`,
            })),
          });
        }

        return tx.gift.update({
          where: { id: gift.id },
          data: {
            status: 'purchased_via_link',
            purchasedViaLinkBy: guest.name,
            purchasedViaLinkAt: new Date(),
          },
        });
      },
      { maxWait: 5_000, timeout: 10_000 },
    );

    // Não devolve nada do fundo extra: é contabilidade do dono, não do convidado.
    return {
      method: 'link' as const,
      gift: {
        id: gift.id,
        title: gift.title,
        status: gift.status,
        productUrl: gift.productUrl,
      },
    };
  }
}
