import 'reflect-metadata';
import { GuestAuthGuard } from '../auth/guest-auth.guard';
import { GuestController } from './guest.controller';
import { GuestThrottlerGuard } from './guest-throttler.guard';

// Chave onde o Nest guarda os guards de @UseGuards().
const GUARDS = '__guards__';

describe('GuestController', () => {
  const guest = { sid: 'sess-1', eventId: 'event-1', name: 'Maria Souza' };
  const request: any = { guest };
  const GIFT_ID = '0b2f1c4e-77aa-4d3e-9f10-aabbccddeeff';
  const CONTRIBUTION_ID = 'c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee';

  let guestService: { getOverview: jest.Mock };
  let contributions: { create: jest.Mock };
  let claims: { claim: jest.Mock };
  let mine: { list: jest.Mock; getPayment: jest.Mock; cancel: jest.Mock };
  let controller: GuestController;

  beforeEach(() => {
    guestService = { getOverview: jest.fn().mockResolvedValue({ gifts: [] }) };
    contributions = { create: jest.fn().mockResolvedValue({ contribution: { id: 'c1' } }) };
    claims = { claim: jest.fn().mockResolvedValue({ method: 'pix' }) };
    mine = {
      list: jest.fn().mockResolvedValue([]),
      getPayment: jest.fn().mockResolvedValue({ payment: {} }),
      cancel: jest.fn().mockResolvedValue({ contribution: { status: 'expired' } }),
    };
    controller = new GuestController(guestService as any, contributions as any, claims as any, mine as any);
  });

  describe('proteção das rotas (regressão de segurança)', () => {
    it('TODAS as rotas do convidado exigem a sessão de convidado (guard no nível da classe)', () => {
      expect(Reflect.getMetadata(GUARDS, GuestController)).toContain(GuestAuthGuard);
    });

    it('as rotas que abrem transação com lock têm rate limit POR SESSÃO; as de leitura não', () => {
      const guardsOf = (method: keyof GuestController) =>
        Reflect.getMetadata(GUARDS, GuestController.prototype[method]) ?? [];

      for (const method of ['createContribution', 'claim', 'cancelMyContribution'] as const) {
        expect(guardsOf(method)).toContain(GuestThrottlerGuard);
      }
      for (const method of ['overview', 'listMyContributions', 'getContributionPayment'] as const) {
        expect(guardsOf(method)).not.toContain(GuestThrottlerGuard);
      }
    });
  });

  describe('a sessão vem SEMPRE do token (request.guest), nunca do corpo', () => {
    it('overview', async () => {
      await controller.overview('casamento-x', request);

      expect(guestService.getOverview).toHaveBeenCalledWith('casamento-x', guest);
    });

    it('createContribution passa só o valor do corpo', async () => {
      await controller.createContribution('casamento-x', GIFT_ID, { amount: 50 }, request);

      expect(contributions.create).toHaveBeenCalledWith('casamento-x', GIFT_ID, guest, 50);
    });

    it('claim passa só o método do corpo', async () => {
      await controller.claim('casamento-x', GIFT_ID, { method: 'link' }, request);

      expect(claims.claim).toHaveBeenCalledWith('casamento-x', GIFT_ID, guest, 'link');
    });

    it('minhas contribuições: listar, reabrir o Pix e cancelar', async () => {
      await controller.listMyContributions('casamento-x', request);
      await controller.getContributionPayment('casamento-x', CONTRIBUTION_ID, request);
      await controller.cancelMyContribution('casamento-x', CONTRIBUTION_ID, request);

      expect(mine.list).toHaveBeenCalledWith('casamento-x', guest);
      expect(mine.getPayment).toHaveBeenCalledWith('casamento-x', CONTRIBUTION_ID, guest);
      expect(mine.cancel).toHaveBeenCalledWith('casamento-x', CONTRIBUTION_ID, guest);
    });
  });
});
