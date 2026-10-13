import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { GuestSession } from '../auth/guest-session.service';
import {
  isTerminalGiftStatus,
  minContributionCents,
  reservedByGift,
  toCents,
} from '../gifts/gift-reservation.util';
import { PrismaService } from '../prisma.service';
import { buildPixPayload } from '../pix/pix-payload';

// Uma cota pendente segura o valor por 48h; depois disso ele volta a ficar
// disponível (a regra de saldo já ignora pendente vencida).
const CONTRIBUTION_TTL_MS = 48 * 60 * 60 * 1000;

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

@Injectable()
export class GuestContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Reserva atômica de uma cota.
  //
  // O problema: dois convidados pagando "o que falta" ao mesmo tempo. Se cada
  // um lesse o saldo e depois gravasse, os dois passariam e a soma estouraria
  // o preço. A solução: dentro de UMA transação, trava a linha do presente
  // (SELECT ... FOR UPDATE). Quem chega depois espera o primeiro terminar e,
  // ao destravar, já enxerga a cota dele ao recalcular o saldo.
  async create(slug: string, giftId: string, guest: GuestSession, amount: number) {
    // select explícito: só o que a resposta precisa (inclui pixKey, que é o
    // ÚNICO lugar onde ela sai pro convidado — e só depois da cota criada).
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, pixKey: true, owner: { select: { name: true } } },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    // Mesmo tratamento do overview: sessão de outro evento = sessão inválida.
    if (event.id !== guest.eventId) {
      throw new UnauthorizedException('Faça o acesso a este evento novamente');
    }

    const amountCents = toCents(amount);

    const created = await this.prisma.$transaction(
      async (tx) => {
        // 1) Trava a linha. Filtra por evento: presente de outro evento (ou id
        //    inexistente) não trava nada e cai no 404 abaixo.
        await tx.$queryRaw`SELECT "id" FROM "gifts" WHERE "id" = ${giftId} AND "event_id" = ${event.id} FOR UPDATE`;

        // 2) Só DEPOIS de travar lê o presente e o saldo — preço e reservas
        //    atuais, não os de antes de esperar na fila.
        const gift = await tx.gift.findFirst({ where: { id: giftId, eventId: event.id } });
        if (!gift) {
          throw new NotFoundException('Presente não encontrado');
        }

        // Comprado pelo link / fechado pelo dono: não aceita mais cotas.
        // (fully_funded NÃO entra aqui de propósito: ele deriva das cotas e
        // pode estar velho — quem decide é o saldo calculado logo abaixo.)
        if (isTerminalGiftStatus(gift.status)) {
          throw new ConflictException({
            message: 'Este presente já foi garantido por outro convidado.',
            code: 'GIFT_UNAVAILABLE',
          });
        }

        const priceCents = toCents(gift.price);
        const reservedCents = toCents((await reservedByGift(tx, [gift.id])).get(gift.id) ?? 0);
        const availableCents = Math.max(0, priceCents - reservedCents);

        if (availableCents === 0) {
          throw new ConflictException({
            message: 'Este presente já foi totalmente reservado por outros convidados.',
            code: 'GIFT_UNAVAILABLE',
          });
        }

        // 3) Regras do valor: mínimo R$ 10 (ou o restante, se menor) e teto =
        //    o que ainda está disponível agora.
        const minCents = minContributionCents(availableCents);

        if (amountCents < minCents) {
          throw new BadRequestException({
            message:
              minCents < 1000
                ? `Para completar este presente, o valor é ${brl(minCents)}.`
                : `O valor mínimo da cota é ${brl(minCents)}.`,
            code: 'AMOUNT_BELOW_MINIMUM',
            minAmount: minCents / 100,
          });
        }

        if (amountCents > availableCents) {
          throw new ConflictException({
            message: `O valor disponível agora é ${brl(availableCents)}. Alguém pode ter reservado uma cota neste instante.`,
            code: 'AMOUNT_EXCEEDS_AVAILABLE',
            availableAmount: availableCents / 100,
          });
        }

        // 4) Grava a cota (pendente, 48h) e acerta o status do presente.
        const contribution = await tx.contribution.create({
          data: {
            giftId: gift.id,
            guestDisplayName: guest.name,
            guestSessionId: guest.sid,
            amount: amountCents / 100,
            status: 'pending',
            expiresAt: new Date(Date.now() + CONTRIBUTION_TTL_MS),
          },
        });

        const newReservedCents = reservedCents + amountCents;
        const status = newReservedCents >= priceCents ? 'fully_funded' : 'partially_funded';
        await tx.gift.update({ where: { id: gift.id }, data: { status } });

        return {
          contribution,
          giftTitle: gift.title,
          status,
          reservedCents: newReservedCents,
          availableCents: Math.max(0, priceCents - newReservedCents),
        };
      },
      // Quem espera na fila pelo lock conta no timeout; folga pra um casamento
      // inteiro abrindo o link ao mesmo tempo no free tier.
      { maxWait: 5_000, timeout: 10_000 },
    );

    const { contribution } = created;

    return {
      contribution: {
        id: contribution.id,
        giftId: contribution.giftId,
        amount: Number(contribution.amount),
        status: contribution.status,
        createdAt: contribution.createdAt,
        expiresAt: contribution.expiresAt,
      },
      gift: {
        id: giftId,
        title: created.giftTitle,
        status: created.status,
        reservedAmount: created.reservedCents / 100,
        availableAmount: created.availableCents / 100,
      },
      payment: {
        pixKey: event.pixKey,
        // null quando a chave do dono não pode virar um BR Code válido: a tela
        // mostra só a chave pra copiar, sem QR.
        pixPayload: buildPixPayload({
          key: event.pixKey,
          amount: Number(contribution.amount),
          merchantName: event.owner.name,
          txid: contribution.id,
        }),
      },
    };
  }
}
