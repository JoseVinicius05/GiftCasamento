import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';

// O preço só pode ser alterado enquanto o presente ainda está "aberto".
// Depois de fully_funded / purchased_via_link / confirmed, mudar o valor
// bagunçaria as contas das cotas já pagas.
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
    status: gift.status,
    createdAt: gift.createdAt,
    // Soma das cotas confirmadas + pendentes ainda dentro das 48h. Hoje é
    // sempre 0 (as cotas chegam na Sprint 4), mas a regra já fica pronta.
    reservedAmount,
  };
}

@Injectable()
export class GiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

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

    const reserved = await this.reservedByGift(gifts.map((gift: any) => gift.id));
    return gifts.map((gift: any) => toGiftResponse(gift, reserved.get(gift.id) ?? 0));
  }

  async update(slug: string, giftId: string, dto: UpdateGiftDto, ownerId: string) {
    const event = await this.eventsService.findBySlugForOwner(slug, ownerId);

    // Procura pelo id E pelo evento: um presente de outro evento (inclusive
    // de outro dono) é "não encontrado", igual a um id que não existe.
    const gift = await this.prisma.gift.findFirst({
      where: { id: giftId, eventId: event.id },
    });
    if (!gift) {
      throw new NotFoundException('Presente não encontrado');
    }

    const reserved = (await this.reservedByGift([gift.id])).get(gift.id) ?? 0;
    const data: Prisma.GiftUncheckedUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.productUrl !== undefined) data.productUrl = dto.productUrl;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;

    if (dto.price !== undefined && dto.price !== Number(gift.price)) {
      if (!PRICE_EDITABLE_STATUSES.includes(gift.status)) {
        throw new ConflictException(
          'Não é possível alterar o preço de um presente que já foi totalmente pago ou comprado.',
        );
      }

      // Não deixa o preço cair abaixo do que os convidados já reservaram ou
      // pagaram em cotas — senão as contas deixariam de fechar.
      //
      // Limitação conhecida: entre esta checagem e o update existe uma
      // janelinha em que uma cota nova pode entrar. A criação de cotas
      // (Sprint 4) valida contra o preço dentro de uma transação atômica,
      // então o pior caso é o dono baixar o preço no mesmo instante em que
      // uma cota é aceita — a Sprint 4 deve revalidar isso.
      if (dto.price < reserved) {
        throw new ConflictException(
          `O preço não pode ficar abaixo de ${formatBRL(reserved)}, que já está reservado ou pago em cotas.`,
        );
      }

      data.price = dto.price;
      // Se o dono mexeu no preço, ele é "manual" — mesmo que tenha vindo do
      // auto-fetch antes.
      data.priceSource = 'manual';
    }

    if (Object.keys(data).length === 0) {
      return toGiftResponse(gift, reserved);
    }

    const updated = await this.prisma.gift.update({ where: { id: gift.id }, data });
    return toGiftResponse(updated, reserved);
  }

  // Soma, por presente, das cotas que "seguram" valor: confirmadas, mais as
  // pendentes que ainda não passaram das 48h (expiresAt no futuro). Pendente
  // vencida não conta, mesmo que o job de expiração ainda não tenha rodado.
  private async reservedByGift(giftIds: string[]): Promise<Map<string, number>> {
    if (giftIds.length === 0) return new Map();

    const rows = await this.prisma.contribution.groupBy({
      by: ['giftId'],
      where: {
        giftId: { in: giftIds },
        OR: [{ status: 'confirmed' }, { status: 'pending', expiresAt: { gt: new Date() } }],
      },
      _sum: { amount: true },
    });

    return new Map(rows.map((row: any) => [row.giftId, Number(row._sum.amount ?? 0)]));
  }
}
