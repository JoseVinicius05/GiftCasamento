import { NotFoundException } from '@nestjs/common';
import { toPixTxid } from '../pix/pix-payload';
import { ContributionsService } from './contributions.service';

const decimal = (value: number) => ({ valueOf: () => String(value), toString: () => String(value) });
const OWNER_ID = 'owner-1';
const inHours = (hours: number) => new Date(Date.now() + hours * 3600_000);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee',
    giftId: 'gift-1',
    guestDisplayName: 'Maria Souza',
    amount: decimal(50),
    status: 'pending',
    createdAt: new Date('2026-10-13T12:00:00Z'),
    expiresAt: inHours(30),
    confirmedAt: null,
    gift: { title: 'Liquidificador', imageUrl: 'https://img/l.jpg' },
    ...overrides,
  };
}

describe('ContributionsService (dono)', () => {
  let prisma: {
    contribution: { findMany: jest.Mock };
    eventExtraFunds: { aggregate: jest.Mock };
    gift: { count: jest.Mock };
  };
  let eventsService: { findBySlugForOwner: jest.Mock };
  let service: ContributionsService;

  beforeEach(() => {
    prisma = {
      contribution: { findMany: jest.fn().mockResolvedValue([]) },
      eventExtraFunds: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null }, _count: { _all: 0 } }) },
      gift: { count: jest.fn().mockResolvedValue(0) },
    };
    eventsService = { findBySlugForOwner: jest.fn().mockResolvedValue({ id: 'event-1' }) };
    service = new ContributionsService(prisma as any, eventsService as any);
  });

  describe('list', () => {
    it('evento de outro dono (ou inexistente): 404 e nenhuma cota é lida', async () => {
      eventsService.findBySlugForOwner.mockRejectedValue(new NotFoundException('Evento não encontrado'));

      await expect(service.list('casamento-x', OWNER_ID)).rejects.toThrow(NotFoundException);

      expect(eventsService.findBySlugForOwner).toHaveBeenCalledWith('casamento-x', OWNER_ID);
      expect(prisma.contribution.findMany).not.toHaveBeenCalled();
    });

    it('só lê cotas dos presentes DESTE evento', async () => {
      await service.list('casamento-x', OWNER_ID);

      expect(prisma.contribution.findMany.mock.calls[0][0].where).toEqual({ gift: { eventId: 'event-1' } });
    });

    it('devolve nome do convidado, presente, valor e a referência do QR (txid)', async () => {
      prisma.contribution.findMany.mockResolvedValue([row()]);

      const [item] = await service.list('casamento-x', OWNER_ID);

      expect(item).toMatchObject({
        id: 'c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee',
        guestName: 'Maria Souza',
        giftTitle: 'Liquidificador',
        amount: 50,
        status: 'pending',
      });
      // Mesma regra do txid do Pix: é o que o dono procura no extrato.
      expect(item.reference).toBe(toPixTxid('c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee'));
      expect(item.reference).toBe('c0b2f1c4e77a4a4d8e9f10aab');
    });

    it('nunca expõe a sessão do convidado nem pede esse campo ao banco', async () => {
      prisma.contribution.findMany.mockResolvedValue([row()]);

      const [item] = await service.list('casamento-x', OWNER_ID);

      expect(item).not.toHaveProperty('guestSessionId');
      expect(prisma.contribution.findMany.mock.calls[0][0].select).not.toHaveProperty('guestSessionId');
    });

    it('status EFETIVO: pendente com prazo vencido chega como expired', async () => {
      prisma.contribution.findMany.mockResolvedValue([
        row({ id: 'a', expiresAt: inHours(-2) }),
        row({ id: 'b', status: 'confirmed', confirmedAt: new Date(), expiresAt: inHours(-9) }),
        row({ id: 'c', status: 'expired' }),
        row({ id: 'd' }),
      ]);

      const result = await service.list('casamento-x', OWNER_ID);

      const byId = Object.fromEntries(result.map((item) => [item.id, item.status]));
      expect(byId).toEqual({ a: 'expired', b: 'confirmed', c: 'expired', d: 'pending' });
    });

    it('o filtro usa o status EFETIVO (uma pendente vencida aparece em "expired", não em "pending")', async () => {
      prisma.contribution.findMany.mockResolvedValue([
        row({ id: 'viva' }),
        row({ id: 'vencida', expiresAt: inHours(-2) }),
      ]);

      const pending = await service.list('casamento-x', OWNER_ID, 'pending');
      const expired = await service.list('casamento-x', OWNER_ID, 'expired');

      expect(pending.map((item) => item.id)).toEqual(['viva']);
      expect(expired.map((item) => item.id)).toEqual(['vencida']);
    });

    it('ordem: pendentes (a que vence primeiro no topo) → vencidas (mais recentes) → confirmadas (mais recentes)', async () => {
      prisma.contribution.findMany.mockResolvedValue([
        row({ id: 'conf-velha', status: 'confirmed', confirmedAt: new Date('2026-10-10T10:00:00Z') }),
        row({ id: 'venc-velha', status: 'expired', createdAt: new Date('2026-10-01T10:00:00Z') }),
        row({ id: 'pend-tarde', expiresAt: inHours(40) }),
        row({ id: 'conf-nova', status: 'confirmed', confirmedAt: new Date('2026-10-12T10:00:00Z') }),
        row({ id: 'venc-nova', status: 'expired', createdAt: new Date('2026-10-05T10:00:00Z') }),
        row({ id: 'pend-cedo', expiresAt: inHours(5) }),
      ]);

      const result = await service.list('casamento-x', OWNER_ID);

      expect(result.map((item) => item.id)).toEqual([
        'pend-cedo',
        'pend-tarde',
        'venc-nova',
        'venc-velha',
        'conf-nova',
        'conf-velha',
      ]);
    });

    it('inExtraFunds: true só quando o valor da cota já foi lançado no saldo extra', async () => {
      prisma.contribution.findMany.mockResolvedValue([
        row({ id: 'a', status: 'expired', extraFund: { id: 'ef-1' } }),
        row({ id: 'b', status: 'expired' }),
      ]);

      const result = await service.list('casamento-x', OWNER_ID);

      const byId = Object.fromEntries(result.map((item) => [item.id, item.inExtraFunds]));
      expect(byId).toEqual({ a: true, b: false });
      expect(prisma.contribution.findMany.mock.calls[0][0].select.extraFund).toEqual({ select: { id: true } });
    });

    it('evento sem cotas: lista vazia', async () => {
      expect(await service.list('casamento-x', OWNER_ID)).toEqual([]);
    });
  });

  describe('summary', () => {
    it('evento de outro dono: 404 e nada é somado', async () => {
      eventsService.findBySlugForOwner.mockRejectedValue(new NotFoundException('Evento não encontrado'));

      await expect(service.summary('casamento-x', OWNER_ID)).rejects.toThrow(NotFoundException);

      expect(prisma.contribution.findMany).not.toHaveBeenCalled();
      expect(prisma.eventExtraFunds.aggregate).not.toHaveBeenCalled();
    });

    it('evento vazio: tudo zerado', async () => {
      expect(await service.summary('casamento-x', OWNER_ID)).toEqual({
        contributions: {
          confirmed: { count: 0, amount: 0 },
          pending: { count: 0, amount: 0 },
          expired: { count: 0, amount: 0 },
        },
        extraFunds: { count: 0, amount: 0 },
        gifts: { total: 0, purchasedViaLink: 0 },
      });
    });

    it('cada cota cai em UM grupo só (status efetivo), sem dupla contagem', async () => {
      prisma.contribution.findMany.mockResolvedValue([
        row({ amount: decimal(100) }), // pendente viva
        row({ amount: decimal(40.5) }), // pendente viva
        row({ amount: decimal(30), expiresAt: inHours(-1) }), // pendente VENCIDA → expired
        row({ amount: decimal(20), status: 'expired' }), // expirada/cancelada
        row({ amount: decimal(200), status: 'confirmed', confirmedAt: new Date() }),
      ]);

      const { contributions } = await service.summary('casamento-x', OWNER_ID);

      expect(contributions).toEqual({
        pending: { count: 2, amount: 140.5 },
        expired: { count: 2, amount: 50 },
        confirmed: { count: 1, amount: 200 },
      });
    });

    it('soma em centavos: sem erro de ponto flutuante (0,1 + 0,2)', async () => {
      prisma.contribution.findMany.mockResolvedValue([
        row({ amount: decimal(0.1), status: 'confirmed' }),
        row({ amount: decimal(0.2), status: 'confirmed' }),
      ]);

      const { contributions } = await service.summary('casamento-x', OWNER_ID);

      expect(contributions.confirmed).toEqual({ count: 2, amount: 0.3 });
    });

    it('fundo extra e presentes: soma e contagens vindas do banco, sempre do evento do dono', async () => {
      prisma.eventExtraFunds.aggregate.mockResolvedValue({ _sum: { amount: decimal(130) }, _count: { _all: 2 } });
      prisma.gift.count.mockImplementation(async ({ where }: any) => (where.status ? 3 : 12));

      const summary = await service.summary('casamento-x', OWNER_ID);

      expect(summary.extraFunds).toEqual({ count: 2, amount: 130 });
      expect(summary.gifts).toEqual({ total: 12, purchasedViaLink: 3 });
      expect(prisma.eventExtraFunds.aggregate.mock.calls[0][0].where).toEqual({ eventId: 'event-1' });
      expect(prisma.gift.count.mock.calls.every((call: any[]) => call[0].where.eventId === 'event-1')).toBe(true);
    });
  });
});
