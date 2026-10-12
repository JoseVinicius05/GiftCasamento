import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GuestService } from './guest.service';

const decimal = (value: number) => ({ valueOf: () => String(value), toString: () => String(value) });
const GUEST = { sid: 's1', eventId: 'event-1', name: 'Maria' };

function giftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    eventId: 'event-1',
    title: 'Liquidificador',
    imageUrl: 'https://img/l.jpg',
    productUrl: 'https://www.amazon.com.br/dp/B0ABCDEFGH',
    price: decimal(300),
    priceSource: 'manual',
    status: 'available',
    createdAt: new Date('2026-10-09T12:00:00Z'),
    ...overrides,
  };
}

describe('GuestService.getOverview', () => {
  let prisma: {
    event: { findUnique: jest.Mock };
    gift: { findMany: jest.Mock };
    contribution: { groupBy: jest.Mock };
  };
  let service: GuestService;

  beforeEach(() => {
    prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'event-1',
          slug: 'casamento-x',
          title: 'Casamento Ana & João',
          eventType: 'casamento',
          eventDate: new Date('2027-03-14T00:00:00Z'),
        }),
      },
      gift: { findMany: jest.fn().mockResolvedValue([]) },
      contribution: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    service = new GuestService(prisma as any);
  });

  it('evento inexistente: 404', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    await expect(service.getOverview('nao-existe', GUEST)).rejects.toThrow(NotFoundException);
    expect(prisma.gift.findMany).not.toHaveBeenCalled();
  });

  it('sessão de OUTRO evento: 401 e nenhum presente é lido', async () => {
    const promise = service.getOverview('casamento-x', { ...GUEST, eventId: 'event-2' });

    await expect(promise).rejects.toThrow(UnauthorizedException);
    expect(prisma.gift.findMany).not.toHaveBeenCalled();
  });

  it('nunca pede a chave Pix nem o hash da senha ao banco', async () => {
    await service.getOverview('casamento-x', GUEST);

    const select = prisma.event.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('pixKey');
    expect(select).not.toHaveProperty('guestPasswordHash');
    expect(select).not.toHaveProperty('ownerId');
  });

  it('devolve evento, nome do convidado e presentes com valor disponível', async () => {
    prisma.gift.findMany.mockResolvedValue([
      giftRow({ id: 'g1' }),
      giftRow({ id: 'g2', title: 'Jogo de panelas', price: decimal(500), status: 'partially_funded' }),
    ]);
    prisma.contribution.groupBy.mockResolvedValue([{ giftId: 'g2', _sum: { amount: decimal(120.5) } }]);

    const result = await service.getOverview('casamento-x', GUEST);

    expect(result.event.title).toBe('Casamento Ana & João');
    expect(result.guest).toEqual({ name: 'Maria' });
    expect(prisma.gift.findMany.mock.calls[0][0].where).toEqual({ eventId: 'event-1' });
    expect(prisma.gift.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' });
    expect(result.gifts[0]).toMatchObject({ id: 'g1', price: 300, reservedAmount: 0, availableAmount: 300 });
    expect(result.gifts[1]).toMatchObject({ id: 'g2', price: 500, reservedAmount: 120.5, availableAmount: 379.5 });
  });

  it('o presente não expõe nada além dos campos públicos', async () => {
    prisma.gift.findMany.mockResolvedValue([giftRow()]);

    const result = await service.getOverview('casamento-x', GUEST);

    expect(Object.keys(result.gifts[0]).sort()).toEqual(
      ['availableAmount', 'id', 'imageUrl', 'price', 'productUrl', 'reservedAmount', 'status', 'title'],
    );
  });

  it('reservado acima do preço nunca gera disponível negativo', async () => {
    prisma.gift.findMany.mockResolvedValue([giftRow()]);
    prisma.contribution.groupBy.mockResolvedValue([{ giftId: 'g1', _sum: { amount: decimal(350) } }]);

    const result = await service.getOverview('casamento-x', GUEST);

    expect(result.gifts[0].availableAmount).toBe(0);
  });

  it('evita erro de ponto flutuante (300 - 0,1 - 0,2)', async () => {
    prisma.gift.findMany.mockResolvedValue([giftRow()]);
    prisma.contribution.groupBy.mockResolvedValue([{ giftId: 'g1', _sum: { amount: decimal(0.3) } }]);

    const result = await service.getOverview('casamento-x', GUEST);

    expect(result.gifts[0].availableAmount).toBe(299.7);
  });
});
