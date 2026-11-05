import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContributionsController } from './contributions.controller';

// Chave onde o Nest guarda os guards de @UseGuards().
const GUARDS = '__guards__';

describe('ContributionsController', () => {
  const request: any = { userId: 'owner-1' };
  let service: { list: jest.Mock; summary: jest.Mock };
  let controller: ContributionsController;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue([{ id: 'c1' }]),
      summary: jest.fn().mockResolvedValue({ extraFunds: { count: 0, amount: 0 } }),
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
});
