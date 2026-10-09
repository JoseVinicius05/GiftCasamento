import { ConflictException, NotFoundException } from '@nestjs/common';
import { GiftsService } from './gifts.service';

const OWNER_ID = 'owner-1';
const EVENT = { id: 'event-1', slug: 'casamento-x' };

// Simula o Decimal do Prisma: aceita Number() e vira texto no JSON.
const decimal = (value: number) => ({ valueOf: () => String(value), toString: () => String(value) });

function giftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gift-1',
    eventId: EVENT.id,
    productUrl: 'https://www.amazon.com.br/dp/B0ABCDEFGH',
    title: 'Liquidificador',
    imageUrl: 'https://img/l.jpg',
    price: decimal(300),
    priceSource: 'manual',
    status: 'available',
    createdAt: new Date('2026-10-09T12:00:00Z'),
    ...overrides,
  };
}

describe('GiftsService', () => {
  let prisma: {
    gift: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    contribution: { groupBy: jest.Mock };
  };
  let eventsService: { findBySlugForOwner: jest.Mock };
  let service: GiftsService;

  beforeEach(() => {
    prisma = {
      gift: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      contribution: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    eventsService = { findBySlugForOwner: jest.fn().mockResolvedValue(EVENT) };
    service = new GiftsService(prisma as any, eventsService as any);
  });

  describe('create', () => {
    it('usa o id do evento achado pelo ownership e devolve o preço como NÚMERO', async () => {
      prisma.gift.create.mockResolvedValue(giftRow({ price: decimal(249.9), priceSource: 'auto' }));

      const result = await service.create(
        'casamento-x',
        { title: 'Liquidificador', price: 249.9, priceSource: 'auto' },
        OWNER_ID,
      );

      expect(eventsService.findBySlugForOwner).toHaveBeenCalledWith('casamento-x', OWNER_ID);
      expect(prisma.gift.create.mock.calls[0][0].data.eventId).toBe('event-1');
      expect(result.price).toBe(249.9);
      expect(result.reservedAmount).toBe(0);
    });

    it('link e imagem opcionais viram null no banco', async () => {
      prisma.gift.create.mockResolvedValue(giftRow({ productUrl: null, imageUrl: null }));

      await service.create('casamento-x', { title: 'Vaquinha', price: 100, priceSource: 'manual' }, OWNER_ID);

      const data = prisma.gift.create.mock.calls[0][0].data;
      expect(data.productUrl).toBeNull();
      expect(data.imageUrl).toBeNull();
    });

    it('evento de outro dono: o 404 do ownership propaga e NADA é gravado', async () => {
      eventsService.findBySlugForOwner.mockRejectedValue(new NotFoundException('Evento não encontrado'));

      const promise = service.create(
        'evento-alheio',
        { title: 'X', price: 10, priceSource: 'manual' },
        OWNER_ID,
      );

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.gift.create).toHaveBeenCalledTimes(0);
    });
  });

  describe('findAll', () => {
    it('lista os presentes do evento com o valor reservado de cada um', async () => {
      prisma.gift.findMany.mockResolvedValue([
        giftRow({ id: 'g1' }),
        giftRow({ id: 'g2', title: 'Jogo de panelas' }),
      ]);
      prisma.contribution.groupBy.mockResolvedValue([{ giftId: 'g1', _sum: { amount: decimal(120) } }]);

      const result = await service.findAll('casamento-x', OWNER_ID);

      expect(prisma.gift.findMany.mock.calls[0][0].where).toEqual({ eventId: 'event-1' });
      expect(result.map((g: any) => g.reservedAmount)).toEqual([120, 0]);
      expect(result[0].price).toBe(300);
    });

    it('sem presentes: devolve lista vazia e nem consulta cotas', async () => {
      prisma.gift.findMany.mockResolvedValue([]);

      expect(await service.findAll('casamento-x', OWNER_ID)).toEqual([]);
      expect(prisma.contribution.groupBy).toHaveBeenCalledTimes(0);
    });

    it('pendente vencida não conta como reservada (filtra por expiresAt no futuro)', async () => {
      prisma.gift.findMany.mockResolvedValue([giftRow()]);

      await service.findAll('casamento-x', OWNER_ID);

      const where = prisma.contribution.groupBy.mock.calls[0][0].where;
      expect(where.OR[0]).toEqual({ status: 'confirmed' });
      expect(where.OR[1].status).toBe('pending');
      expect(where.OR[1].expiresAt.gt instanceof Date).toBe(true);
    });
  });

  describe('update', () => {
    it('presente de outro evento (ou id inexistente): 404 e nada é alterado', async () => {
      prisma.gift.findFirst.mockResolvedValue(null);

      const promise = service.update('casamento-x', 'gift-9', { title: 'Novo' }, OWNER_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.gift.findFirst.mock.calls[0][0].where).toEqual({ id: 'gift-9', eventId: 'event-1' });
      expect(prisma.gift.update).toHaveBeenCalledTimes(0);
    });

    it('editar só o título não mexe no preço nem na origem do preço', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow({ priceSource: 'auto' }));
      prisma.gift.update.mockResolvedValue(giftRow({ title: 'Novo nome', priceSource: 'auto' }));

      await service.update('casamento-x', 'gift-1', { title: 'Novo nome' }, OWNER_ID);

      expect(prisma.gift.update.mock.calls[0][0].data).toEqual({ title: 'Novo nome' });
    });

    it('mudar o preço marca priceSource como manual', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow({ priceSource: 'auto' }));
      prisma.gift.update.mockResolvedValue(giftRow({ price: decimal(350), priceSource: 'manual' }));

      const result = await service.update('casamento-x', 'gift-1', { price: 350 }, OWNER_ID);

      expect(prisma.gift.update.mock.calls[0][0].data).toEqual({ price: 350, priceSource: 'manual' });
      expect(result.price).toBe(350);
    });

    it('preço abaixo do que já está reservado em cotas: 409 e nada é gravado', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow({ status: 'partially_funded' }));
      prisma.contribution.groupBy.mockResolvedValue([{ giftId: 'gift-1', _sum: { amount: decimal(200) } }]);

      const promise = service.update('casamento-x', 'gift-1', { price: 150 }, OWNER_ID);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.gift.update).toHaveBeenCalledTimes(0);
    });

    it('preço IGUAL ao reservado ainda é permitido', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow({ status: 'partially_funded' }));
      prisma.contribution.groupBy.mockResolvedValue([{ giftId: 'gift-1', _sum: { amount: decimal(200) } }]);
      prisma.gift.update.mockResolvedValue(giftRow({ price: decimal(200) }));

      await service.update('casamento-x', 'gift-1', { price: 200 }, OWNER_ID);

      expect(prisma.gift.update).toHaveBeenCalledTimes(1);
    });

    it('presente já totalmente pago não aceita mudança de preço (409)', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow({ status: 'fully_funded' }));

      const promise = service.update('casamento-x', 'gift-1', { price: 999 }, OWNER_ID);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.gift.update).toHaveBeenCalledTimes(0);
    });

    it('mas o título de um presente já pago continua editável', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow({ status: 'fully_funded' }));
      prisma.gift.update.mockResolvedValue(giftRow({ status: 'fully_funded', title: 'Corrigido' }));

      await service.update('casamento-x', 'gift-1', { title: 'Corrigido' }, OWNER_ID);

      expect(prisma.gift.update).toHaveBeenCalledTimes(1);
    });

    it('mandar o MESMO preço não conta como mudança (não vira manual, não bloqueia)', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow({ status: 'fully_funded', priceSource: 'auto' }));

      const result = await service.update('casamento-x', 'gift-1', { price: 300 }, OWNER_ID);

      expect(prisma.gift.update).toHaveBeenCalledTimes(0);
      expect(result.price).toBe(300);
    });

    it('null apaga o link e a imagem', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow());
      prisma.gift.update.mockResolvedValue(giftRow({ productUrl: null, imageUrl: null }));

      await service.update('casamento-x', 'gift-1', { productUrl: null, imageUrl: null }, OWNER_ID);

      expect(prisma.gift.update.mock.calls[0][0].data).toEqual({ productUrl: null, imageUrl: null });
    });

    it('PATCH vazio devolve o presente atual sem tocar no banco', async () => {
      prisma.gift.findFirst.mockResolvedValue(giftRow());

      const result = await service.update('casamento-x', 'gift-1', {}, OWNER_ID);

      expect(prisma.gift.update).toHaveBeenCalledTimes(0);
      expect(result.title).toBe('Liquidificador');
    });
  });
});
