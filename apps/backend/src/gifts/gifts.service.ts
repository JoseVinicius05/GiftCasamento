import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';
import { deriveGiftStatus, reservedByGift } from './gift-reservation.util';

// O preço só pode ser alterado enquanto o presente ainda está "aberto".
// Depois de fully_funded / purchased_via_link / confirmed, mudar o valor
// bagunçaria as contas das cotas já pagas. A checagem usa o status DERIVADO
// das cotas (deriveGiftStatus), não o gravado: cota pendente que expira não
// atualiza o banco, e um "fully_funded" velho não pode travar o dono.
const PRICE_EDITABLE_STATUSES = ['available', 'partially_funded'];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// O Prisma devolve Decimal (que vira texto no JSON). Aqui convertemos pra
// número, que é o que o frontend espera. Number() funciona tanto pra Decimal
// quanto pra number.
function toGiftResponse(gift: any, reservedAmount: number) {
  return {
    id: gift.id,
    productUrl: gift.productUrl,
    title: gift.title,
    imageUrl: gift.imageUrl,
    price: Number(gift.price),
    priceSource: gift.priceSource,
    // Derivado das cotas, igual ao que o convidado vê (o gravado pode estar
    // velho quando uma cota pendente expira — não há job que o atualize).
    status: deriveGiftStatus(gift.status, gift.price, reservedAmount),
    createdAt: gift.createdAt,
    // Soma das cotas confirmadas + pendentes ainda dentro das 48h.
    reservedAmount,
    // Quem marcou "comprei pelo link" e quando (null se não aconteceu) — o
    // dono precisa saber a quem agradecer e o que conferir na entrega.
    purchasedViaLinkBy: gift.purchasedViaLinkBy ?? null,
    purchasedViaLinkAt: gift.purchasedViaLinkAt ?? null,
  };
}

@Injectable()
export class GiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) { }

  // Todos os métodos começam por findBySlugForOwner: 404 (nunca 403) se o
  // evento não existe OU é de outro dono — mesmo padrão do módulo de eventos.
  // E o eventId vem SEMPRE do evento achado aqui, nunca do que o cliente mandou.

  async create(slug: string, dto: CreateGiftDto, ownerId: string) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    const gift = await this.prisma.gift.create({
      data: {
        eventId: event.id,
        productUrl: dto.productUrl ?? null,
        title: dto.title,
        imageUrl: dto.imageUrl ?? null,
        price: dto.price,
        priceSource: dto.priceSource,
      },
    });

    return toGiftResponse(gift, 0);
  }

  async findAll(slug: string, ownerId: string) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    const gifts = await this.prisma.gift.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
    });

    const reserved = await reservedByGift(this.prisma, gifts.map((gift: any) => gift.id));
    return gifts.map((gift: any) => toGiftResponse(gift, reserved.get(gift.id) ?? 0));
  }

  async update(slug: string, giftId: string, dto: UpdateGiftDto, ownerId: string) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    // Tudo numa transação com a linha do presente TRAVADA (SELECT ... FOR
    // UPDATE) — o mesmo lock da criação de cota, do "comprei pelo link" e do
    // cancelamento. Assim o dono não consegue baixar o preço no mesmo instante
    // em que uma cota é aceita: uma das duas operações espera a outra e já
    // enxerga o resultado dela.
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "gifts" WHERE "id" = ${giftId} AND "event_id" = ${event.id} FOR UPDATE`;

        // Procura pelo id E pelo evento: um presente de outro evento (inclusive
        // de outro dono) é "não encontrado", igual a um id que não existe.
        const gift = await tx.gift.findFirst({
          where: { id: giftId, eventId: event.id },
        });
        if (!gift) {
          throw new NotFoundException('Presente não encontrado');
        }

        const reserved = (await reservedByGift(tx, [gift.id])).get(gift.id) ?? 0;
        const data: Prisma.GiftUncheckedUpdateInput = {};

        if (dto.title !== undefined) data.title = dto.title;
        if (dto.productUrl !== undefined) data.productUrl = dto.productUrl;
        if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;

        if (dto.price !== undefined && dto.price !== Number(gift.price)) {
          const currentStatus = deriveGiftStatus(gift.status, gift.price, reserved);

          if (!PRICE_EDITABLE_STATUSES.includes(currentStatus)) {
            throw new ConflictException(
              'Não é possível alterar o preço de um presente que já foi totalmente pago ou comprado.',
            );
          }

          // Não deixa o preço cair abaixo do que os convidados já reservaram ou
          // pagaram em cotas — senão as contas deixariam de fechar. O reservado
          // foi lido COM o presente travado, então nenhuma cota entra entre esta
          // checagem e o update.
          if (dto.price < reserved) {
            throw new ConflictException(
              `O preço não pode ficar abaixo de ${formatBRL(reserved)}, que já está reservado ou pago em cotas.`,
            );
          }

          data.price = dto.price;
          // Se o dono mexeu no preço, ele é "manual" — mesmo que tenha vindo do
          // auto-fetch antes.
          data.priceSource = 'manual';

          // O preço novo pode mudar se o presente já está coberto (ex.: baixar
          // o preço até o valor reservado). Grava o status certo agora, em vez
          // de deixar o banco velho até a próxima cota.
          const nextStatus = deriveGiftStatus(gift.status, dto.price, reserved);
          if (nextStatus !== gift.status) {
            data.status = nextStatus as Prisma.GiftUncheckedUpdateInput['status'];
          }
        }

        if (Object.keys(data).length === 0) {
          return toGiftResponse(gift, reserved);
        }

        const updated = await tx.gift.update({ where: { id: gift.id }, data });
        return toGiftResponse(updated, reserved);
      },
      { maxWait: 5_000, timeout: 10_000 },
    );
  }

  async remove(slug: string, giftId: string, ownerId: string): Promise<void> {
    // Confirma que o evento existe e pertence ao usuário autenticado.
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    try {
      // Contagem + exclusão na mesma transação, com o presente travado: uma
      // cota que entra "no mesmo instante" ou vence a corrida (e aí a contagem
      // abaixo enxerga e recusa) ou perde (e a criação de cota recebe 404).
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "gifts" WHERE "id" = ${giftId} AND "event_id" = ${event.id} FOR UPDATE`;

          // O presente precisa pertencer ao evento informado.
          const gift = await tx.gift.findFirst({
            where: { id: giftId, eventId: event.id },
          });

          if (!gift) {
            throw new NotFoundException('Presente não encontrado');
          }

          // Preserva presentes que já avançaram no fluxo de pagamento ou compra.
          if (gift.status !== 'available') {
            throw new ConflictException(
              'Este presente não pode ser excluído porque já possui movimentação ou histórico de pagamento/compra.',
            );
          }

          // Verifica TODAS as contribuições, inclusive as expiradas.
          // Não apagamos o histórico financeiro dos convidados.
          const contributionCount = await tx.contribution.count({
            where: { giftId: gift.id },
          });

          if (contributionCount > 0) {
            throw new ConflictException(
              'Este presente possui histórico de contribuições e não pode ser excluído.',
            );
          }

          // O schema define onDelete: SetNull para EventExtraFunds.sourceGift.
          // Assim, o histórico de saldo extra permanece mesmo após a exclusão.
          await tx.gift.delete({
            where: { id: gift.id },
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      // Rede de segurança: se mesmo assim o banco recusar por chave
      // estrangeira (P2003 — existe uma contribuição apontando pro presente),
      // é um conflito de negócio, não um erro 500.
      if ((error as { code?: string } | null)?.code === 'P2003') {
        throw new ConflictException(
          'Este presente possui histórico de contribuições e não pode ser excluído.',
        );
      }
      throw error;
    }
  }
}
