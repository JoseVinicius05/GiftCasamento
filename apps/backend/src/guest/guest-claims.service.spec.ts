import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GuestClaimsService } from './guest-claims.service';

const decimal = (value: number) => ({ valueOf: () => String(value), toString: () => String(value) });
const GUEST = { sid: 'sess-1', eventId: 'event-1', name: 'Maria Souza' };
const GIFT_ID = '0b2f1c4e-77aa-4d3e-9f10-aabbccddeeff';

function giftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: GIFT_ID,
    eventId: 'event-1',
    title: 'Liquidificador',
    productUrl: 'https://www.amazon.com.br/dp/B0ABCDEFGH',
    price: decimal(300),
    status: 'available',
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

describe('GuestClaimsService.claim', () => {
  let order: string[];
  let tx: {
    $queryRaw: jest.Mock;
    gift: { findFirst: jest.Mock; update: jest.Mock };
    contribution: { groupBy: jest.Mock; findMany: jest.Mock };
    eventExtraFunds: { createMany: jest.Mock };
  };
  let prisma: { event: { findUnique: jest.Mock }; $transaction: jest.Mock };
  let contributions: { create: jest.Mock };
  let service: GuestClaimsService;

  // `reserved` = o que o groupBy devolve (confirmadas + pendentes vivas);
  // `confirmed` = as cotas confirmadas do presente (viram fundo extra).
  function setup(
    gift: Record<string, unknown> | null = giftRow(),
    reserved = 0,
    confirmed: { amount: unknown; guestDisplayName: string }[] = [],
  ) {
    order = [];
    tx = {
      $queryRaw: jest.fn().mockImplementation(async () => { order.push('lock'); return []; }),
      gift: {
        findFirst: jest.fn().mockImplementation(async () => { order.push('findGift'); return gift; }),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          order.push('updateGift');
          return { ...(gift as object), ...data };
        }),
      },
      contribution: {
        groupBy: jest.fn().mockImplementation(async () => {
          order.push('reserved');
          return reserved > 0 ? [{ giftId: GIFT_ID, _sum: { amount: decimal(reserved) } }] : [];
        }),
        findMany: jest.fn().mockImplementation(async () => { order.push('findConfirmed'); return confirmed; }),
      },
      eventExtraFunds: {
        createMany: jest.fn().mockImplementation(async () => { order.push('extraFunds'); return { count: confirmed.length }; }),
      },
    };
    prisma = {
      event: { findUnique: jest.fn().mockResolvedValue({ id: 'event-1' }) },
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(tx)),
    };
    contributions = {
      create: jest.fn().mockResolvedValue({
        contribution: { id: 'c1', amount: 300 },
        gift: { id: GIFT_ID, status: 'fully_funded' },
        payment: { pixKey: 'ana@example.com', pixPayload: '0002...' },
      }),
    };
    service = new GuestClaimsService(prisma as any, contributions as any);
  }

  beforeEach(() => setup());

  describe("method 'pix'", () => {
    it("vira uma cota do valor restante ('remaining') e devolve os dados de pagamento", async () => {
      const result = await service.claim('casamento-x', GIFT_ID, GUEST, 'pix');

      expect(contributions.create).toHaveBeenCalledWith('casamento-x', GIFT_ID, GUEST, 'remaining');
      expect(result).toMatchObject({
        method: 'pix',
        contribution: { id: 'c1' },
        payment: { pixKey: 'ana@example.com' },
      });
    });

    it('não abre nenhuma transação própria (a cota cuida de tudo)', async () => {
      await service.claim('casamento-x', GIFT_ID, GUEST, 'pix');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('os erros da cota (409 etc.) passam direto', async () => {
      contributions.create.mockRejectedValue(new NotFoundException('Presente não encontrado'));

      await expect(service.claim('casamento-x', GIFT_ID, GUEST, 'pix')).rejects.toThrow(NotFoundException);
    });
  });

  describe("method 'link'", () => {
    it('evento inexistente: 404 e nenhuma transação', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.claim('x', GIFT_ID, GUEST, 'link')).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sessão de OUTRO evento: 401 e nenhuma transação', async () => {
      await expect(
        service.claim('casamento-x', GIFT_ID, { ...GUEST, eventId: 'event-2' }, 'link'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('presente de outro evento (ou inexistente): 404 e nada é gravado', async () => {
      setup(null);

      await expect(service.claim('casamento-x', GIFT_ID, GUEST, 'link')).rejects.toThrow(NotFoundException);
      expect(tx.gift.update).not.toHaveBeenCalled();
      expect(tx.eventExtraFunds.createMany).not.toHaveBeenCalled();
    });

    it('trava a linha ANTES de ler e só depois grava (mesmo lock das cotas)', async () => {
      await service.claim('casamento-x', GIFT_ID, GUEST, 'link');

      expect(order).toEqual(['lock', 'findGift', 'reserved', 'findConfirmed', 'updateGift']);
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([GIFT_ID, 'event-1']);
    });

    it('fecha o presente guardando QUEM marcou e QUANDO', async () => {
      const before = Date.now();
      const result = await service.claim('casamento-x', GIFT_ID, GUEST, 'link');

      const data = tx.gift.update.mock.calls[0][0].data;
      expect(data.status).toBe('purchased_via_link');
      expect(data.purchasedViaLinkBy).toBe('Maria Souza');
      expect(data.purchasedViaLinkAt.getTime() >= before).toBe(true);

      expect(result).toEqual({
        method: 'link',
        gift: {
          id: GIFT_ID,
          title: 'Liquidificador',
          status: 'purchased_via_link',
          productUrl: 'https://www.amazon.com.br/dp/B0ABCDEFGH',
        },
      });
    });

    it('sem cotas confirmadas: não mexe no fundo extra', async () => {
      await service.claim('casamento-x', GIFT_ID, GUEST, 'link');

      expect(tx.eventExtraFunds.createMany).not.toHaveBeenCalled();
    });

    it('presente parcialmente pago: cada cota CONFIRMADA vira uma linha do fundo extra, antes de fechar', async () => {
      setup(giftRow({ status: 'partially_funded' }), 130, [
        { amount: decimal(100), guestDisplayName: 'João' },
        { amount: decimal(30), guestDisplayName: 'Paula' },
      ]);

      await service.claim('casamento-x', GIFT_ID, GUEST, 'link');

      const rows = tx.eventExtraFunds.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(2);
      expect(rows.map((row: any) => Number(row.amount))).toEqual([100, 30]);
      expect(rows.every((row: any) => row.eventId === 'event-1' && row.sourceGiftId === GIFT_ID)).toBe(true);
      expect(rows[0].note).toContain('João');
      expect(rows[0].note).toContain('Liquidificador');
      expect(rows[0].note).toContain('Maria Souza');
      expect(order.indexOf('extraFunds') < order.indexOf('updateGift')).toBe(true);
    });

    it('só lê as cotas confirmadas deste presente; as pendentes NÃO são tocadas', async () => {
      setup(giftRow({ status: 'partially_funded' }), 130, [{ amount: decimal(100), guestDisplayName: 'João' }]);

      await service.claim('casamento-x', GIFT_ID, GUEST, 'link');

      expect(tx.contribution.findMany.mock.calls[0][0].where).toEqual({ giftId: GIFT_ID, status: 'confirmed' });
      expect(tx.contribution).not.toHaveProperty('update');
      expect(tx.contribution).not.toHaveProperty('updateMany');
    });

    it('já comprado pelo link ou confirmado: 409 GIFT_UNAVAILABLE e nada é gravado', async () => {
      for (const status of ['purchased_via_link', 'confirmed']) {
        setup(giftRow({ status }));

        const error = await failure(service.claim('casamento-x', GIFT_ID, GUEST, 'link'));

        expect(error.getResponse()).toMatchObject({ code: 'GIFT_UNAVAILABLE' });
        expect(tx.gift.update).not.toHaveBeenCalled();
        expect(tx.eventExtraFunds.createMany).not.toHaveBeenCalled();
      }
    });

    it('presente sem link de compra: 400 NO_PRODUCT_URL', async () => {
      setup(giftRow({ productUrl: null }));

      const error = await failure(service.claim('casamento-x', GIFT_ID, GUEST, 'link'));

      expect(error.getResponse()).toMatchObject({ code: 'NO_PRODUCT_URL' });
      expect(tx.gift.update).not.toHaveBeenCalled();
    });

    it('tudo já reservado por cotas vivas: 409 e nada é gravado', async () => {
      setup(giftRow({ status: 'fully_funded' }), 300);

      const error = await failure(service.claim('casamento-x', GIFT_ID, GUEST, 'link'));

      expect(error.getResponse()).toMatchObject({ code: 'GIFT_UNAVAILABLE' });
      expect(tx.gift.update).not.toHaveBeenCalled();
      expect(tx.eventExtraFunds.createMany).not.toHaveBeenCalled();
    });

    it('fully_funded VELHO (as pendentes expiraram) deixa comprar pelo link', async () => {
      setup(giftRow({ status: 'fully_funded' }), 0);

      const result = await service.claim('casamento-x', GIFT_ID, GUEST, 'link');

      expect(result.gift.status).toBe('purchased_via_link');
    });

    it('não vaza o fundo extra na resposta do convidado', async () => {
      setup(giftRow({ status: 'partially_funded' }), 100, [{ amount: decimal(100), guestDisplayName: 'João' }]);

      const result = await service.claim('casamento-x', GIFT_ID, GUEST, 'link');

      expect(JSON.stringify(result)).not.toContain('João');
      expect(Object.keys(result).sort()).toEqual(['gift', 'method']);
    });
  });
});
