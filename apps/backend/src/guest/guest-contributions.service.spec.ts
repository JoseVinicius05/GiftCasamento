import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GuestContributionsService } from './guest-contributions.service';

const decimal = (value: number) => ({ valueOf: () => String(value), toString: () => String(value) });
const GUEST = { sid: 'sess-1', eventId: 'event-1', name: 'Maria Souza' };
const GIFT_ID = '0b2f1c4e-77aa-4d3e-9f10-aabbccddeeff';

function giftRow(overrides: Record<string, unknown> = {}) {
  return { id: GIFT_ID, eventId: 'event-1', title: 'Liquidificador', price: decimal(300), status: 'available', ...overrides };
}

// Devolve a exceção lançada (pra conferir o corpo { message, code, ... }).
async function failure(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('era esperado que lançasse uma exceção');
}

describe('GuestContributionsService.create', () => {
  let order: string[];
  let tx: {
    $queryRaw: jest.Mock;
    gift: { findFirst: jest.Mock; update: jest.Mock };
    contribution: { groupBy: jest.Mock; create: jest.Mock };
  };
  let prisma: { event: { findUnique: jest.Mock }; $transaction: jest.Mock };
  let service: GuestContributionsService;

  // `reserved` = soma que o groupBy devolve pro presente (confirmadas + pendentes vivas).
  function setup(gift: Record<string, unknown> | null = giftRow(), reserved = 0) {
    order = [];
    tx = {
      $queryRaw: jest.fn().mockImplementation(async () => { order.push('lock'); return []; }),
      gift: {
        findFirst: jest.fn().mockImplementation(async () => { order.push('findGift'); return gift; }),
        update: jest.fn().mockImplementation(async () => { order.push('updateGift'); return {}; }),
      },
      contribution: {
        groupBy: jest.fn().mockImplementation(async () => {
          order.push('reserved');
          return reserved > 0 ? [{ giftId: GIFT_ID, _sum: { amount: decimal(reserved) } }] : [];
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          order.push('createContribution');
          return { id: 'c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee', createdAt: new Date(), ...data };
        }),
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
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(tx)),
    };
    service = new GuestContributionsService(prisma as any);
  }

  beforeEach(() => setup());

  it('evento inexistente: 404 e nenhuma transação aberta', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    await expect(service.create('x', GIFT_ID, GUEST, 50)).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sessão de OUTRO evento: 401 e nenhuma transação aberta', async () => {
    await expect(
      service.create('casamento-x', GIFT_ID, { ...GUEST, eventId: 'event-2' }, 50),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('presente de outro evento (ou id inexistente): 404 e nada é gravado', async () => {
    setup(null);

    await expect(service.create('casamento-x', GIFT_ID, GUEST, 50)).rejects.toThrow(NotFoundException);
    expect(tx.contribution.create).not.toHaveBeenCalled();
    expect(tx.gift.update).not.toHaveBeenCalled();
  });

  it('trava a linha do presente ANTES de ler o saldo e só então grava', async () => {
    await service.create('casamento-x', GIFT_ID, GUEST, 50);

    expect(order).toEqual(['lock', 'findGift', 'reserved', 'createContribution', 'updateGift']);
  });

  it('o lock só vale pro presente DO evento (filtra por event_id)', async () => {
    await service.create('casamento-x', GIFT_ID, GUEST, 50);

    const values = tx.$queryRaw.mock.calls[0].slice(1);
    expect(values).toEqual([GIFT_ID, 'event-1']);
  });

  it('cria cota pendente de 48h ligada à sessão e ao nome do convidado', async () => {
    const before = Date.now();
    const result = await service.create('casamento-x', GIFT_ID, GUEST, 50);

    const data = tx.contribution.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      giftId: GIFT_ID,
      guestDisplayName: 'Maria Souza',
      guestSessionId: 'sess-1',
      amount: 50,
      status: 'pending',
    });
    const ttl = data.expiresAt.getTime() - before;
    expect(ttl >= 48 * 3600_000 - 1000 && ttl <= 48 * 3600_000 + 5000).toBe(true);

    expect(result.contribution).toMatchObject({ giftId: GIFT_ID, amount: 50, status: 'pending' });
    expect(result.gift).toEqual({
      id: GIFT_ID,
      title: 'Liquidificador',
      status: 'partially_funded',
      reservedAmount: 50,
      availableAmount: 250,
    });
    expect(tx.gift.update).toHaveBeenCalledWith({ where: { id: GIFT_ID }, data: { status: 'partially_funded' } });
  });

  it('o saldo é lido pela transação (tx), não pelo client normal', async () => {
    await service.create('casamento-x', GIFT_ID, GUEST, 50);

    expect(tx.contribution.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma).not.toHaveProperty('contribution');
  });

  it('somando ao que já está reservado: disponível diminui', async () => {
    setup(giftRow(), 120.5);

    const result = await service.create('casamento-x', GIFT_ID, GUEST, 100);

    expect(result.gift.reservedAmount).toBe(220.5);
    expect(result.gift.availableAmount).toBe(79.5);
  });

  it('pagar exatamente o que falta: presente vira fully_funded', async () => {
    setup(giftRow(), 120.5);

    const result = await service.create('casamento-x', GIFT_ID, GUEST, 179.5);

    expect(result.gift).toMatchObject({ status: 'fully_funded', reservedAmount: 300, availableAmount: 0 });
    expect(tx.gift.update).toHaveBeenCalledWith({ where: { id: GIFT_ID }, data: { status: 'fully_funded' } });
  });

  it('acima do disponível: 409 com o valor disponível e NADA é gravado', async () => {
    setup(giftRow(), 120.5);

    const error = await failure(service.create('casamento-x', GIFT_ID, GUEST, 179.51));

    expect(error.getResponse()).toMatchObject({ code: 'AMOUNT_EXCEEDS_AVAILABLE', availableAmount: 179.5 });
    expect(tx.contribution.create).not.toHaveBeenCalled();
    expect(tx.gift.update).not.toHaveBeenCalled();
  });

  it('abaixo do mínimo de R$ 10: 400 com o mínimo', async () => {
    const error = await failure(service.create('casamento-x', GIFT_ID, GUEST, 9.99));

    expect(error.getResponse()).toMatchObject({ code: 'AMOUNT_BELOW_MINIMUM', minAmount: 10 });
    expect(tx.contribution.create).not.toHaveBeenCalled();
  });

  it('R$ 10 exatos é aceito', async () => {
    const result = await service.create('casamento-x', GIFT_ID, GUEST, 10);

    expect(result.contribution.amount).toBe(10);
  });

  it('restante menor que R$ 10: só o restante exato é aceito', async () => {
    setup(giftRow(), 293); // faltam R$ 7

    const abaixo = await failure(service.create('casamento-x', GIFT_ID, GUEST, 5));
    expect(abaixo.getResponse()).toMatchObject({ code: 'AMOUNT_BELOW_MINIMUM', minAmount: 7 });

    const result = await service.create('casamento-x', GIFT_ID, GUEST, 7);
    expect(result.gift.status).toBe('fully_funded');
  });

  it('não erra por ponto flutuante (faltam R$ 0,30)', async () => {
    setup(giftRow(), 299.7);

    const result = await service.create('casamento-x', GIFT_ID, GUEST, 0.3);

    expect(result.gift).toMatchObject({ status: 'fully_funded', availableAmount: 0 });
  });

  it('totalmente reservado: 409 GIFT_UNAVAILABLE', async () => {
    setup(giftRow({ status: 'fully_funded' }), 300);

    const error = await failure(service.create('casamento-x', GIFT_ID, GUEST, 10));

    expect(error.getResponse()).toMatchObject({ code: 'GIFT_UNAVAILABLE' });
    expect(tx.contribution.create).not.toHaveBeenCalled();
  });

  it('fully_funded VELHO (as pendentes expiraram) volta a aceitar cotas', async () => {
    setup(giftRow({ status: 'fully_funded' }), 0);

    const result = await service.create('casamento-x', GIFT_ID, GUEST, 100);

    expect(result.gift.status).toBe('partially_funded');
  });

  it('comprado pelo link ou confirmado: 409 GIFT_UNAVAILABLE', async () => {
    for (const status of ['purchased_via_link', 'confirmed']) {
      setup(giftRow({ status }), 0);

      const error = await failure(service.create('casamento-x', GIFT_ID, GUEST, 50));

      expect(error.getResponse()).toMatchObject({ code: 'GIFT_UNAVAILABLE' });
      expect(tx.contribution.create).not.toHaveBeenCalled();
    }
  });

  it('devolve a chave Pix e um Copia e Cola válido com o valor da cota', async () => {
    const result = await service.create('casamento-x', GIFT_ID, GUEST, 25.5);

    expect(result.payment.pixKey).toBe('ana.joao@example.com');
    const payload = result.payment.pixPayload!;
    expect(payload).toMatch(/^000201/);
    expect(payload).toContain('BR.GOV.BCB.PIX');
    expect(payload).toContain('540525.50');
    expect(payload).toContain('ANA SOUZA');
  });

  it('chave Pix que não vira BR Code: pixPayload null, mas a chave continua na resposta', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 'event-1',
      pixKey: 'minha chave maluca',
      owner: { name: 'Ana Souza' },
    });

    const result = await service.create('casamento-x', GIFT_ID, GUEST, 50);

    expect(result.payment).toEqual({ pixKey: 'minha chave maluca', pixPayload: null });
  });

  it('só pede ao banco o que precisa do evento (sem hash de senha)', async () => {
    await service.create('casamento-x', GIFT_ID, GUEST, 50);

    const select = prisma.event.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('guestPasswordHash');
  });
});
