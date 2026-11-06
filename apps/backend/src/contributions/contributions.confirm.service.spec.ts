import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContributionsService } from './contributions.service';

const decimal = (value: number) => ({ valueOf: () => String(value), toString: () => String(value) });
const OWNER_ID = 'owner-1';
const EVENT_ID = 'event-1';
const GIFT_ID = '0b2f1c4e-77aa-4d3e-9f10-aabbccddeeff';
const CONTRIBUTION_ID = 'c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee';
const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000);

function contributionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRIBUTION_ID,
    amount: decimal(50),
    status: 'pending',
    expiresAt: inHours(30),
    guestDisplayName: 'Maria Souza',
    extraFund: null,
    ...overrides,
  };
}

function giftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: GIFT_ID,
    title: 'Liquidificador',
    price: decimal(300),
    status: 'partially_funded',
    purchasedViaLinkBy: null,
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

describe('ContributionsService (dono) — confirmar / rejeitar (Sprint 5, Dia 2)', () => {
  let order: string[];
  let tx: {
    $queryRaw: jest.Mock;
    contribution: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock; groupBy: jest.Mock };
    gift: { findUnique: jest.Mock; update: jest.Mock };
    eventExtraFunds: { create: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };
  let eventsService: { findBySlugForOwner: jest.Mock };
  let service: ContributionsService;

  // `reservedAfter` = o que o groupBy devolve na leitura do reservado.
  // Pode ser uma lista (uma resposta por chamada) para simular antes/depois.
  function setup(
    opts: {
      contribution?: Record<string, unknown> | null;
      gift?: Record<string, unknown>;
      reserved?: number[];
    } = {},
  ) {
    const stored = opts.contribution === undefined ? contributionRow() : opts.contribution;
    const gift = opts.gift ?? giftRow();
    const reservedSeq = [...(opts.reserved ?? [0])];

    order = [];
    tx = {
      $queryRaw: jest.fn().mockImplementation(async () => {
        order.push('lock');
        return [];
      }),
      contribution: {
        findFirst: jest.fn().mockImplementation(async () => {
          order.push('findMine');
          return stored ? { giftId: GIFT_ID } : null;
        }),
        findUnique: jest.fn().mockImplementation(async () => {
          order.push('reread');
          return stored;
        }),
        update: jest.fn().mockImplementation(async () => {
          order.push('updateContribution');
          return {};
        }),
        groupBy: jest.fn().mockImplementation(async () => {
          order.push('reserved');
          const value = reservedSeq.length > 1 ? reservedSeq.shift()! : reservedSeq[0];
          return value > 0 ? [{ giftId: GIFT_ID, _sum: { amount: decimal(value) } }] : [];
        }),
      },
      gift: {
        findUnique: jest.fn().mockImplementation(async () => {
          order.push('readGift');
          return gift;
        }),
        update: jest.fn().mockImplementation(async () => {
          order.push('updateGift');
          return {};
        }),
      },
      eventExtraFunds: {
        create: jest.fn().mockImplementation(async () => {
          order.push('extraFund');
          return {};
        }),
      },
    };
    prisma = { $transaction: jest.fn().mockImplementation(async (callback: any) => callback(tx)) };
    eventsService = { findBySlugForOwner: jest.fn().mockResolvedValue({ id: EVENT_ID }) };
    service = new ContributionsService(prisma as any, eventsService as any);
  }

  beforeEach(() => setup());

  describe('segurança (ownership)', () => {
    it('evento de outro dono: 404 e nenhuma transação é aberta (confirmar e rejeitar)', async () => {
      eventsService.findBySlugForOwner.mockRejectedValue(new NotFoundException('Evento não encontrado'));

      await expect(service.confirm('x', OWNER_ID, CONTRIBUTION_ID)).rejects.toThrow(NotFoundException);
      await expect(service.reject('x', OWNER_ID, CONTRIBUTION_ID)).rejects.toThrow(NotFoundException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cota de OUTRO evento (ou inexistente): 404, nada é travado nem gravado', async () => {
      setup({ contribution: null });

      await expect(service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID)).rejects.toThrow(NotFoundException);
      await expect(service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID)).rejects.toThrow(NotFoundException);

      // A busca é SEMPRE restrita aos presentes do evento do dono.
      expect(tx.contribution.findFirst.mock.calls[0][0].where).toEqual({ id: CONTRIBUTION_ID, gift: { eventId: EVENT_ID } });
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.contribution.update).not.toHaveBeenCalled();
      expect(tx.eventExtraFunds.create).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('trava o presente ANTES de reler a cota e só então grava (lock → leitura → escrita)', async () => {
      await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      expect(order).toEqual(['findMine', 'lock', 'reread', 'readGift', 'updateContribution', 'reserved', 'updateGift']);
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([GIFT_ID, EVENT_ID]);
    });

    it('pendente dentro do prazo: vira confirmed com confirmedAt e conta no presente', async () => {
      setup({ reserved: [100] });
      const before = Date.now();

      const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      const update = tx.contribution.update.mock.calls[0][0];
      expect(update.where).toEqual({ id: CONTRIBUTION_ID });
      expect(update.data.status).toBe('confirmed');
      expect(update.data.confirmedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(tx.eventExtraFunds.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        outcome: 'applied',
        extraFund: null,
        contribution: { id: CONTRIBUTION_ID, status: 'confirmed' },
        gift: { id: GIFT_ID, status: 'partially_funded', reservedAmount: 100, availableAmount: 200 },
      });
    });

    it('recalcula o status gravado do presente (cotas cobrem o preço → fully_funded)', async () => {
      setup({ reserved: [300] });

      const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      expect(tx.gift.update).toHaveBeenCalledWith({ where: { id: GIFT_ID }, data: { status: 'fully_funded' } });
      expect(result.gift.status).toBe('fully_funded');
      expect(result.gift.availableAmount).toBe(0);
    });

    it('não regrava o status do presente quando ele já está certo', async () => {
      setup({ reserved: [100] }); // partially_funded já é o gravado

      await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      expect(tx.gift.update).not.toHaveBeenCalled();
    });

    it('já confirmada: 409 ALREADY_CONFIRMED e nada é gravado (idempotência)', async () => {
      setup({ contribution: contributionRow({ status: 'confirmed' }) });

      const error = await failure(service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID));

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse().code).toBe('ALREADY_CONFIRMED');
      expect(tx.contribution.update).not.toHaveBeenCalled();
      expect(tx.eventExtraFunds.create).not.toHaveBeenCalled();
    });

    it('valor já lançado no fundo extra: 409 ALREADY_CONFIRMED — mesmo com acceptExpired (só uma linha)', async () => {
      setup({ contribution: contributionRow({ status: 'expired', extraFund: { id: 'ef-1' } }) });

      const error = await failure(service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID, true));

      expect(error.getResponse().code).toBe('ALREADY_CONFIRMED');
      expect(tx.eventExtraFunds.create).not.toHaveBeenCalled();
    });

    describe('cota vencida ou cancelada', () => {
      it('sem acceptExpired: 409 CONTRIBUTION_EXPIRED, nada é gravado', async () => {
        for (const stored of [
          contributionRow({ status: 'expired' }), // cancelada / rejeitada
          contributionRow({ expiresAt: inHours(-2) }), // pendente que venceu (ainda gravada como pending)
        ]) {
          setup({ contribution: stored });

          const error = await failure(service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID));

          expect(error).toBeInstanceOf(ConflictException);
          expect(error.getResponse().code).toBe('CONTRIBUTION_EXPIRED');
          expect(tx.contribution.update).not.toHaveBeenCalled();
          expect(tx.eventExtraFunds.create).not.toHaveBeenCalled();
        }
      });

      it('"Recebi mesmo assim" e o presente AINDA comporta: vira confirmed e conta nele', async () => {
        setup({ contribution: contributionRow({ status: 'expired' }), reserved: [100, 150] });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID, true);

        expect(tx.contribution.update.mock.calls[0][0].data.status).toBe('confirmed');
        expect(tx.eventExtraFunds.create).not.toHaveBeenCalled();
        expect(result.outcome).toBe('applied');
        expect(result.contribution.status).toBe('confirmed');
        // O disponível é checado ANTES de confirmar, com o reservado SEM a cota vencida.
        expect(result.gift.reservedAmount).toBe(150);
      });

      it('cabe EXATAMENTE no que sobra: confirma (fronteira em centavos) e fecha o presente', async () => {
        // preço 300, reservado 250 → sobram 50, e a cota é de 50.
        setup({ contribution: contributionRow({ status: 'expired' }), reserved: [250, 300] });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID, true);

        expect(result.outcome).toBe('applied');
        expect(result.gift.status).toBe('fully_funded');
      });

      it('"Recebi mesmo assim" e o presente NÃO comporta: valor vai para o fundo extra e a cota fica expired', async () => {
        // preço 300, já reservado 280 por outros → sobram 20 < 50.
        setup({ contribution: contributionRow({ status: 'expired' }), reserved: [280] });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID, true);

        expect(tx.contribution.update).not.toHaveBeenCalled(); // segue expired
        expect(tx.eventExtraFunds.create).toHaveBeenCalledTimes(1);
        expect(tx.eventExtraFunds.create.mock.calls[0][0].data).toMatchObject({
          eventId: EVENT_ID,
          sourceGiftId: GIFT_ID,
          contributionId: CONTRIBUTION_ID,
        });
        expect(tx.eventExtraFunds.create.mock.calls[0][0].data.amount).toEqual(decimal(50));
        expect(tx.eventExtraFunds.create.mock.calls[0][0].data.note).toContain('Maria Souza');
        expect(tx.eventExtraFunds.create.mock.calls[0][0].data.note).toContain('após o vencimento');
        expect(result).toMatchObject({
          outcome: 'extra_funds',
          extraFund: { amount: 50 },
          contribution: { id: CONTRIBUTION_ID, status: 'expired', confirmedAt: null },
        });
        // O presente nunca passa do preço por causa do Pix tardio.
        expect(result.gift.reservedAmount).toBe(280);
      });

      it('Pix tardio num presente totalmente coberto por outros: fundo extra, presente intacto', async () => {
        setup({
          contribution: contributionRow({ status: 'expired' }),
          gift: giftRow({ status: 'fully_funded' }),
          reserved: [300],
        });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID, true);

        expect(result.outcome).toBe('extra_funds');
        expect(tx.gift.update).not.toHaveBeenCalled();
        expect(result.gift.status).toBe('fully_funded');
      });

      it('pendente com prazo vencido (ainda gravada como pending) também exige o flag e usa o mesmo caminho', async () => {
        setup({ contribution: contributionRow({ expiresAt: inHours(-5) }), reserved: [0, 50] });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID, true);

        expect(result.outcome).toBe('applied');
        expect(tx.contribution.update.mock.calls[0][0].data.status).toBe('confirmed');
      });
    });

    describe('presente já fechado (decisão 4)', () => {
      it('comprado pelo link: a cota vira confirmed E o valor vai para o fundo extra, na mesma transação', async () => {
        setup({ gift: giftRow({ status: 'purchased_via_link', purchasedViaLinkBy: 'Carlos' }), reserved: [50] });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID);

        expect(tx.contribution.update.mock.calls[0][0].data.status).toBe('confirmed');
        expect(tx.eventExtraFunds.create).toHaveBeenCalledTimes(1);
        const note = tx.eventExtraFunds.create.mock.calls[0][0].data.note;
        expect(note).toContain('comprado pelo link por Carlos');
        expect(result).toMatchObject({
          outcome: 'extra_funds',
          extraFund: { amount: 50 },
          contribution: { status: 'confirmed' },
        });
        // Presente terminal nunca muda de status.
        expect(tx.gift.update).not.toHaveBeenCalled();
        expect(result.gift.status).toBe('purchased_via_link');
      });

      it('cota vencida confirmada com acceptExpired num presente comprado pelo link: confirmed + fundo extra', async () => {
        setup({
          contribution: contributionRow({ status: 'expired' }),
          gift: giftRow({ status: 'purchased_via_link', purchasedViaLinkBy: 'Carlos' }),
        });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID, true);

        expect(result.outcome).toBe('extra_funds');
        expect(result.contribution.status).toBe('confirmed');
        expect(tx.eventExtraFunds.create).toHaveBeenCalledTimes(1);
      });

      it('presente já entregue (confirmed): também vai para o fundo extra, com nota própria', async () => {
        setup({ gift: giftRow({ status: 'confirmed' }) });

        const result = await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID);

        expect(result.outcome).toBe('extra_funds');
        expect(tx.eventExtraFunds.create.mock.calls[0][0].data.note).toContain('entregue');
        expect(tx.gift.update).not.toHaveBeenCalled();
      });
    });

    it('a transação usa os timeouts do padrão do projeto', async () => {
      await service.confirm('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      expect(prisma.$transaction.mock.calls[0][1]).toEqual({ maxWait: 5_000, timeout: 10_000 });
    });
  });

  describe('reject', () => {
    it('trava o presente ANTES de reler a cota e só então grava (lock → leitura → escrita)', async () => {
      await service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      expect(order).toEqual(['findMine', 'lock', 'reread', 'updateContribution', 'readGift', 'reserved', 'updateGift']);
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual([GIFT_ID, EVENT_ID]);
    });

    it('pendente: vira expired agora e o presente sem reservas volta a available', async () => {
      setup({ reserved: [0] });
      const before = Date.now();

      const result = await service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      const data = tx.contribution.update.mock.calls[0][0].data;
      expect(data.status).toBe('expired');
      expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before); // encerrada agora, não daqui a 30h
      expect(data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(tx.gift.update).toHaveBeenCalledWith({ where: { id: GIFT_ID }, data: { status: 'available' } });
      expect(result).toEqual({
        contribution: { id: CONTRIBUTION_ID, status: 'expired' },
        gift: { id: GIFT_ID, title: 'Liquidificador', status: 'available', reservedAmount: 0, availableAmount: 300 },
      });
    });

    it('com outras reservas, o presente fica partially_funded e o disponível volta', async () => {
      setup({ gift: giftRow({ status: 'fully_funded' }), reserved: [200] });

      const result = await service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      expect(result.gift).toMatchObject({ status: 'partially_funded', reservedAmount: 200, availableAmount: 100 });
    });

    it('presente comprado pelo link nunca é reaberto', async () => {
      setup({ gift: giftRow({ status: 'purchased_via_link' }), reserved: [0] });

      const result = await service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      expect(result.gift.status).toBe('purchased_via_link');
      expect(tx.gift.update).not.toHaveBeenCalled();
    });

    it('pendente com prazo vencido (ainda gravada pending): encerra sem "rejuvenescer" o prazo', async () => {
      const venceuEm = inHours(-3);
      setup({ contribution: contributionRow({ expiresAt: venceuEm }) });

      await service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID);

      const data = tx.contribution.update.mock.calls[0][0].data;
      expect(data.status).toBe('expired');
      expect(data.expiresAt).toEqual(venceuEm);
    });

    it('já confirmada: 409 ALREADY_CONFIRMED (não existe "desconfirmar" na Sprint 5)', async () => {
      setup({ contribution: contributionRow({ status: 'confirmed' }) });

      const error = await failure(service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID));

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse().code).toBe('ALREADY_CONFIRMED');
      expect(tx.contribution.update).not.toHaveBeenCalled();
    });

    it('já expirada/cancelada: 409 ALREADY_EXPIRED e nada é gravado', async () => {
      setup({ contribution: contributionRow({ status: 'expired' }) });

      const error = await failure(service.reject('casamento-x', OWNER_ID, CONTRIBUTION_ID));

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse().code).toBe('ALREADY_EXPIRED');
      expect(tx.contribution.update).not.toHaveBeenCalled();
      expect(tx.gift.update).not.toHaveBeenCalled();
    });
  });
});
