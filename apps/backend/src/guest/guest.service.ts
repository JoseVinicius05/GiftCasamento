import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { GuestSession } from '../auth/guest-session.service';
import { reservedByGift } from '../gifts/gift-reservation.util';
import { PrismaService } from '../prisma.service';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Presente como o CONVIDADO enxerga. Campos que NUNCA entram aqui: nome de
// quem contribuiu e chave Pix (a chave só sai no momento de contribuir —
// Sprint 4, Dia 2/3).
function toGuestGift(gift: any, reservedAmount: number) {
  const price = Number(gift.price);

  return {
    id: gift.id,
    title: gift.title,
    imageUrl: gift.imageUrl,
    productUrl: gift.productUrl,
    price,
    status: gift.status,
    reservedAmount,
    // Quanto ainda dá pra contribuir/comprar: price - (confirmadas + pendentes vivas).
    availableAmount: Math.max(0, round2(price - reservedAmount)),
  };
}

@Injectable()
export class GuestService {
  constructor(private readonly prisma: PrismaService) {}

  // Visão do convidado: dados públicos do evento + lista de presentes.
  async getOverview(slug: string, guest: GuestSession) {
    // select EXPLÍCITO e sem pixKey: o convidado não vê a chave do dono aqui.
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, slug: true, title: true, eventType: true, eventDate: true },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    // O token é de UM evento. Se alguém usar a sessão do evento A na URL do
    // evento B, trata como sessão inválida — o front volta pra tela de senha.
    if (event.id !== guest.eventId) {
      throw new UnauthorizedException('Faça o acesso a este evento novamente');
    }

    // Mais antigos primeiro: é a ordem em que o dono montou a lista.
    const gifts = await this.prisma.gift.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
    });

    const reserved = await reservedByGift(this.prisma, gifts.map((gift: any) => gift.id));

    return {
      event: {
        slug: event.slug,
        title: event.title,
        eventType: event.eventType,
        eventDate: event.eventDate,
      },
      guest: { name: guest.name },
      gifts: gifts.map((gift: any) => toGuestGift(gift, reserved.get(gift.id) ?? 0)),
    };
  }
}
