import 'reflect-metadata';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GiftsController } from './gifts.controller';

// Chave onde o Nest guarda os guards de @UseGuards().
const GUARDS = '__guards__';

describe('GiftsController', () => {
  const request: any = { userId: 'owner-1' };
  let eventsService: { findBySlugForOwner: jest.Mock };
  let metadataService: { preview: jest.Mock };
  let giftsService: { create: jest.Mock; findAll: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let controller: GiftsController;
  let order: string[];

  beforeEach(() => {
    order = [];
    eventsService = {
      findBySlugForOwner: jest.fn().mockImplementation(async () => {
        order.push('ownership');
        return { id: 'event-1' };
      }),
    };
    metadataService = {
      preview: jest.fn().mockImplementation(async () => {
        order.push('metadata');
        return { title: 'Liquidificador' };
      }),
    };
    giftsService = {
      create: jest.fn().mockResolvedValue({ id: 'gift-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'gift-1' }]),
      update: jest.fn().mockResolvedValue({ id: 'gift-1', title: 'Novo' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    controller = new GiftsController(eventsService as any, metadataService as any, giftsService as any);
  });

  describe('proteção das rotas (regressão de segurança)', () => {
    it('TODAS as rotas exigem o JWT do dono (guard no nível da classe)', () => {
      expect(Reflect.getMetadata(GUARDS, GiftsController)).toContain(JwtAuthGuard);
    });

    it('o rate limit vale só no preview (a rota que aciona serviços pagos)', () => {
      const guardsOf = (method: keyof GiftsController) =>
        Reflect.getMetadata(GUARDS, GiftsController.prototype[method]) ?? [];

      expect(guardsOf('preview')).toContain(ThrottlerGuard);
      for (const method of ['create', 'findAll', 'update', 'remove'] as const) {
        expect(guardsOf(method)).not.toContain(ThrottlerGuard);
      }
    });
  });

  describe('preview', () => {
    it('confere o ownership ANTES de chamar qualquer serviço externo', async () => {
      const result = await controller.preview('casamento-x', { url: 'https://www.amazon.com.br/dp/B0ABCDEFGH' }, request);

      expect(order).toEqual(['ownership', 'metadata']);
      expect(eventsService.findBySlugForOwner).toHaveBeenCalledWith('casamento-x', 'owner-1');
      expect(metadataService.preview).toHaveBeenCalledWith('https://www.amazon.com.br/dp/B0ABCDEFGH');
      expect(result).toEqual({ title: 'Liquidificador' });
    });

    it('evento de outro dono: 404 e o serviço pago NUNCA é chamado', async () => {
      eventsService.findBySlugForOwner.mockRejectedValue(new NotFoundException('Evento não encontrado'));

      await expect(
        controller.preview('casamento-x', { url: 'https://www.amazon.com.br/dp/B0ABCDEFGH' }, request),
      ).rejects.toThrow(NotFoundException);

      expect(metadataService.preview).not.toHaveBeenCalled();
    });
  });

  describe('CRUD: o dono vem SEMPRE do token, nunca do corpo', () => {
    it('create', async () => {
      const dto: any = { title: 'Liquidificador', price: 300, priceSource: 'manual' };

      const result = await controller.create('casamento-x', dto, request);

      expect(giftsService.create).toHaveBeenCalledWith('casamento-x', dto, 'owner-1');
      expect(result).toEqual({ id: 'gift-1' });
    });

    it('findAll', async () => {
      const result = await controller.findAll('casamento-x', request);

      expect(giftsService.findAll).toHaveBeenCalledWith('casamento-x', 'owner-1');
      expect(result).toEqual([{ id: 'gift-1' }]);
    });

    it('update', async () => {
      const result = await controller.update('casamento-x', 'gift-1', { title: 'Novo' }, request);

      expect(giftsService.update).toHaveBeenCalledWith('casamento-x', 'gift-1', { title: 'Novo' }, 'owner-1');
      expect(result).toEqual({ id: 'gift-1', title: 'Novo' });
    });

    it('remove (204: não devolve corpo)', async () => {
      const result = await controller.remove('casamento-x', 'gift-1', request);

      expect(giftsService.remove).toHaveBeenCalledWith('casamento-x', 'gift-1', 'owner-1');
      expect(result).toBeUndefined();
    });

    it('os erros do serviço (404/409) propagam', async () => {
      giftsService.remove.mockRejectedValue(new NotFoundException('Presente não encontrado'));

      await expect(controller.remove('casamento-x', 'gift-9', request)).rejects.toThrow(NotFoundException);
    });
  });
});
