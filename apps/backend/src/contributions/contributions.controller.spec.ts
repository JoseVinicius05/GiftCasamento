import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContributionsController } from './contributions.controller';
import { ConfirmContributionDto } from './dto/confirm-contribution.dto';

// Chave onde o Nest guarda os guards de @UseGuards().
const GUARDS = '__guards__';

describe('ContributionsController', () => {
  const request: any = { userId: 'owner-1' };
  let service: { list: jest.Mock; summary: jest.Mock; confirm: jest.Mock; reject: jest.Mock };
  let controller: ContributionsController;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue([{ id: 'c1' }]),
      summary: jest.fn().mockResolvedValue({ extraFunds: { count: 0, amount: 0 } }),
      confirm: jest.fn().mockResolvedValue({ outcome: 'applied' }),
      reject: jest.fn().mockResolvedValue({ contribution: { status: 'expired' } }),
    };
    controller = new ContributionsController(service as any);
  });

  it('TODAS as rotas exigem o JWT do dono (guard no nível da classe)', () => {
    expect(Reflect.getMetadata(GUARDS, ContributionsController)).toContain(JwtAuthGuard);
  });

  it('list: o dono vem SEMPRE do token e o filtro de status vem da query', async () => {
    const result = await controller.list('casamento-x', { status: 'pending' }, request);

    expect(service.list).toHaveBeenCalledWith('casamento-x', 'owner-1', 'pending');
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('list sem filtro', async () => {
    await controller.list('casamento-x', {}, request);

    expect(service.list).toHaveBeenCalledWith('casamento-x', 'owner-1', undefined);
  });

  it('summary', async () => {
    await controller.summary('casamento-x', request);

    expect(service.summary).toHaveBeenCalledWith('casamento-x', 'owner-1');
  });

  it('o 404 de ownership propaga', async () => {
    service.list.mockRejectedValue(new NotFoundException('Evento não encontrado'));

    await expect(controller.list('casamento-x', {}, request)).rejects.toThrow(NotFoundException);
  });

  describe('confirmar / rejeitar (Dia 2)', () => {
    const CONTRIBUTION_ID = 'c0b2f1c4-e77a-4a4d-8e9f-10aabbccddee';

    it('as rotas de escrita NÃO têm guard próprio que enfraqueça o do dono (herdam o da classe)', () => {
      for (const method of ['confirm', 'reject'] as const) {
        const own = Reflect.getMetadata(GUARDS, ContributionsController.prototype[method]) ?? [];
        expect(own).not.toContain(undefined);
      }
      expect(Reflect.getMetadata(GUARDS, ContributionsController)).toContain(JwtAuthGuard);
    });

    it('confirm: o dono vem SEMPRE do token; sem acceptExpired = confirmação normal', async () => {
      const result = await controller.confirm('casamento-x', CONTRIBUTION_ID, {} as ConfirmContributionDto, request);

      expect(service.confirm).toHaveBeenCalledWith('casamento-x', 'owner-1', CONTRIBUTION_ID, false);
      expect(result).toEqual({ outcome: 'applied' });
    });

    it('confirm: acceptExpired true é repassado ("Recebi mesmo assim")', async () => {
      await controller.confirm('casamento-x', CONTRIBUTION_ID, { acceptExpired: true }, request);

      expect(service.confirm).toHaveBeenCalledWith('casamento-x', 'owner-1', CONTRIBUTION_ID, true);
    });

    it('confirm: só `true` de verdade liga o flag (qualquer outra coisa é confirmação normal)', async () => {
      await controller.confirm('casamento-x', CONTRIBUTION_ID, { acceptExpired: false }, request);
      await controller.confirm('casamento-x', CONTRIBUTION_ID, undefined as any, request);

      expect(service.confirm.mock.calls.map((call) => call[3])).toEqual([false, false]);
    });

    it('reject: o dono vem do token', async () => {
      await controller.reject('casamento-x', CONTRIBUTION_ID, request);

      expect(service.reject).toHaveBeenCalledWith('casamento-x', 'owner-1', CONTRIBUTION_ID);
    });

    it('o 404 de ownership propaga nas duas rotas', async () => {
      service.confirm.mockRejectedValue(new NotFoundException('Evento não encontrado'));
      service.reject.mockRejectedValue(new NotFoundException('Evento não encontrado'));

      await expect(controller.confirm('x', CONTRIBUTION_ID, {}, request)).rejects.toThrow(NotFoundException);
      await expect(controller.reject('x', CONTRIBUTION_ID, request)).rejects.toThrow(NotFoundException);
    });
  });
});
