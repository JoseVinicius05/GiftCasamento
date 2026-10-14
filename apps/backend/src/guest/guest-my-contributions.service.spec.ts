import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GuestMyContributionsService } from './guest-my-contributions.service';

const decimal = (value: number) => ({ valueOf: () => String(value), toString: () => String(value) });
const GUEST = { sid: 'sess-1', eventId: 'event-1', name: 'Maria Souza' };
const GIFT_ID = '0b2f1c4e-77aa-4d3e-9f10-aabbccddeeff';
const CONTRIBUTION_ID = 'c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee';

const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000);

function contributionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRIBUTION_ID,
    giftId: GIFT_ID,
    amount: decimal(50),
    status: 'pending',
    createdAt: new Date('2026-10-13T12:00:00Z'),
    expiresAt: inHours(30),
    gift: { title: 'Liquidificador', imageUrl: 'https://img/l.jpg' },
    ...overrides,
  };
}

async function failure(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('era esperado que lançasse uma exceção');
}

describe('GuestMyContributionsService', () => {
  let order: string[];
  let tx: {
    $queryRaw: jest.Mock;
    contribution: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock; groupBy: jest.Mock };
    gift: { findUnique: jest.Mock; update: jest.Mock };
  };
  let prisma: {
    event: { findUnique: jest.Mock };
    contribution: { findMany: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: GuestMyContributionsService;

  // `reservedAfter` = o que o groupBy devolve DEPOIS do cancelamento.
  function setup(opts: { contribution?: Record<string, unknown> | null; gift?: Record<string, unknown>; reservedAfter?: number } = {}) {
    const stored = opts.contribution === undefined ? contributionRow() : opts.contribution;
    const gift = opts.gift ?? {
      id: GIFT_ID,
      title: 'Liquidificador',
      price: decimal(300),
      status: 'partially_funded',
    };
    const reservedAfter = opts.reservedAfter ?? 0;

    order = [];
    tx = {
      $queryRaw: jest.fn().mockImplementation(async () => { order.push('lock'); return []; }),
      contribution: {
        findFirst: jest.fn().mockImplementation(async () => { order.push('findMine'); return stored ? { giftId: GIFT_ID } : null; }),
        findUnique: jest.fn().mockImplementation(async () => { order.push('reread'); return stored; }),
        update: jest.fn().mockImplementation(async () => { order.push('cancel'); return {}; }),
        groupBy: jest.fn().mockImplementation(async () => {
          order.push('reserved');
          return reservedAfter > 0 ? [{ giftId: GIFT_ID, _sum: { amount: decimal(reservedAfter) } }] : [];
        }),
      },
      gift: {
        findUnique: jest.fn().mockImplementation(async () => { order.push('readGift'); return gift; }),
        update: jest.fn().mockImplementation(async () => { order.push('updateGift'); return {}; }),
      },
    };
    prisma = {
      event: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'event-1',
          pixKey: 'ana.joao@example.com',
          owner: { name: 'Ana Souza' },
        }),
      },
      contribution: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(stored),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(tx)),
    };
    service = new GuestMyContributionsService(prisma as any);
  }

  beforeEach(() => setup());

  describe('list', () => {
    it('evento inexistente: 404; sessão de outro evento: 401 — e nada é consultado', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.list('x', GUEST)).rejects.toThrow(NotFoundException);

      setup();
      await expect(service.list('casamento-x', { ...GUEST, eventId: 'event-2' })).rejects.toThrow(UnauthorizedException);
      expect(prisma.contribution.findMany).not.toHaveBeenCalled();
    });

    it('filtra pela SESSÃO e pelo evento, mais recentes primeiro', async () => {
      await service.list('casamento-x', GUEST);

      const args = prisma.contribution.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ guestSessionId: 'sess-1', gift: { eventId: 'event-1' } });
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('devolve os dados da cota e do presente, sem chave Pix', async () => {
      prisma.contribution.findMany.mockResolvedValue([contributionRow()]);

      const result = await service.list('casamento-x', GUEST);

      expect(result).toHaveLength(1);
      expect(Object.keys(result[0]).sort()).toEqual(
        ['amount', 'createdAt', 'expiresAt', 'giftId', 'giftImageUrl', 'giftTitle', 'id', 'status'],
      );
      expect(result[0]).toMatchObject({ id: CONTRIBUTION_ID, amount: 50, giftTitle: 'Liquidificador', status: 'pending' });
      expect(JSON.stringify(result)).not.toContain('example.com');
      const select = prisma.contribution.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('guestSessionId');
    });

    it('pendente com prazo vencido aparece como expired; confirmada e expirada continuam', async () => {
      prisma.contribution.findMany.mockResolvedValue([
        contributionRow({ id: 'a', expiresAt: inHours(-1) }),
        contributionRow({ id: 'b', status: 'confirmed', expiresAt: inHours(-5) }),
        contributionRow({ id: 'c', status: 'expired' }),
        contributionRow({ id: 'd' }),
      ]);

      const result = await service.list('casamento-x', GUEST);

      expect(result.map((row) => row.status)).toEqual(['expired', 'confirmed', 'expired', 'pending']);
    });
  });

  describe('getPayment', () => {
    it('evento inexistente 404; sessão de outro evento 401', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.getPayment('x', CONTRIBUTION_ID, GUEST)).rejects.toThrow(NotFoundException);

      setup();
      await expect(
        service.getPayment('casamento-x', CONTRIBUTION_ID, { ...GUEST, eventId: 'event-2' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('só procura cota da própria sessão e do evento; de outra sessão = 404', async () => {
      setup({ contribution: null });

      await expect(service.getPayment('casamento-x', CONTRIBUTION_ID, GUEST)).rejects.toThrow(NotFoundException);

      expect(prisma.contribution.findFirst.mock.calls[0][0].where).toEqual({
        id: CONTRIBUTION_ID,
        guestSessionId: 'sess-1',
        gift: { eventId: 'event-1' },
      });
    });

    it('cota pendente: devolve chave Pix e Copia e Cola com o valor da cota', async () => {
      const result = await service.getPayment('casamento-x', CONTRIBUTION_ID, GUEST);

      expect(result.contribution).toMatchObject({ id: CONTRIBUTION_ID, amount: 50, status: 'pending' });
      expect(result.gift).toEqual({ id: GIFT_ID, title: 'Liquidificador' });
      expect(result.payment.pixKey).toBe('ana.joao@example.com');
      expect(result.payment.pixPayload).toContain('540550.00');
      // txid = id da cota (sem hífens, até 25 caracteres)
      expect(result.payment.pixPayload).toContain('c0b2f1c4e77a4a4d8e9f10aab');
    });

    it('confirmada, expirada/cancelada ou pendente vencida: 409 CONTRIBUTION_NOT_PAYABLE', async () => {
      for (const contribution of [
        contributionRow({ status: 'confirmed' }),
        contributionRow({ status: 'expired' }),
        contributionRow({ expiresAt: inHours(-1) }),
      ]) {
        setup({ contribution });

        const error = await failure(service.getPayment('casamento-x', CONTRIBUTION_ID, GUEST));

        expect(error.getResponse()).toMatchObject({ code: 'CONTRIBUTION_NOT_PAYABLE' });
      }
    });
  });

  describe('cancel', () => {
    it('evento inexistente 404; sessão de outro evento 401; nenhuma transação aberta', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.cancel('x', CONTRIBUTION_ID, GUEST)).rejects.toThrow(NotFoundException);

      setup();
      await expect(
        service.cancel('casamento-x', CONTRIBUTION_ID, { ...GUEST, eventId: 'event-2' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cota de outra sessão (ou inexistente): 404 e nada é gravado', async () => {
      setup({ contribution: null });

      await expect(service.cancel('casamento-x', CONTRIBUTION_ID, GUEST)).rejects.toThrow(NotFoundException);

      expect(tx.contribution.findFirst.mock.calls[0][0].where).toEqual({
        id: CONTRIBUTION_ID,
        guestSessionId: 'sess-1',
        gift: { eventId: 'event-1' },
      });
      expect(tx.contribution.update).not.toHaveBeenCalled();
    });

    it('trava o presente ANTES de reler a cota e só então grava', async () => {
      await service.cancel('casamento-x', CONTRIBUTION_ID, GUEST);

      expect(order).toEqual(['findMine', 'lock', 'reread', 'cancel', 'readGift', 'reserved', 'updateGift']);
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([GIFT_ID]);
    });

    it('a cota vira expired agora e o presente sem reservas volta a available', async () => {
      const before = Date.now();
      const result = await service.cancel('casamento-x', CONTRIBUTION_ID, GUEST);

      const data = tx.contribution.update.mock.calls[0][0].data;
      expect(data.status).toBe('expired');
      expect(data.expiresAt.getTime() >= before).toBe(true);
      expect(tx.gift.update).toHaveBeenCalledWith({ where: { id: GIFT_ID }, data: { status: 'available' } });
      expect(result).toEqual({
        contribution: { id: CONTRIBUTION_ID, status: 'expired' },
        gift: { id: GIFT_ID, title: 'Liquidificador', status: 'available', reservedAmount: 0, availableAmount: 300 },
      });
    });

    it('sobrando outras reservas, o presente continua partially_funded (sem update desnecessário)', async () => {
      setup({ reservedAfter: 100 });

      const result = await service.cancel('casamento-x', CONTRIBUTION_ID, GUEST);

      expect(tx.gift.update).not.toHaveBeenCalled();
      expect(result.gift).toMatchObject({ status: 'partially_funded', reservedAmount: 100, availableAmount: 200 });
    });

    it('presente fully_funded só por esta cota volta a partially_funded', async () => {
      setup({
        gift: { id: GIFT_ID, title: 'Liquidificador', price: decimal(300), status: 'fully_funded' },
        reservedAfter: 250,
      });

      const result = await service.cancel('casamento-x', CONTRIBUTION_ID, GUEST);

      expect(tx.gift.update).toHaveBeenCalledWith({ where: { id: GIFT_ID }, data: { status: 'partially_funded' } });
      expect(result.gift).toMatchObject({ status: 'partially_funded', availableAmount: 50 });
    });

    it('presente comprado pelo link nunca é reaberto pelo cancelamento', async () => {
      setup({ gift: { id: GIFT_ID, title: 'Liquidificador', price: decimal(300), status: 'purchased_via_link' } });

      const result = await service.cancel('casamento-x', CONTRIBUTION_ID, GUEST);

      expect(tx.gift.update).not.toHaveBeenCalled();
      expect(result.gift.status).toBe('purchased_via_link');
    });

    it('já confirmada: 409 e nada é gravado', async () => {
      setup({ contribution: contributionRow({ status: 'confirmed' }) });

      const error = await failure(service.cancel('casamento-x', CONTRIBUTION_ID, GUEST));

      expect(error.getResponse()).toMatchObject({ code: 'CONTRIBUTION_NOT_CANCELLABLE' });
      expect(error.getResponse().message).toContain('confirmada');
      expect(tx.contribution.update).not.toHaveBeenCalled();
      expect(tx.gift.update).not.toHaveBeenCalled();
    });

    it('já expirada/cancelada ou com prazo vencido: 409 e nada é gravado', async () => {
      for (const contribution of [contributionRow({ status: 'expired' }), contributionRow({ expiresAt: inHours(-1) })]) {
        setup({ contribution });

        const error = await failure(service.cancel('casamento-x', CONTRIBUTION_ID, GUEST));

        expect(error.getResponse()).toMatchObject({ code: 'CONTRIBUTION_NOT_CANCELLABLE' });
        expect(tx.contribution.update).not.toHaveBeenCalled();
      }
    });
  });
});
