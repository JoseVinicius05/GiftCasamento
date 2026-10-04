import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let prisma: { event: { findUnique: jest.Mock; update: jest.Mock } };
  let service: EventsService;

  beforeEach(() => {
    prisma = { event: { findUnique: jest.fn(), update: jest.fn() } };
    service = new EventsService(prisma as any);
  });

  it('gera um slug no formato "titulo-sufixo" quando não há colisão', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    const slug = await service.generateUniqueSlug('Casamento Ana & João');

    expect(slug).toMatch(/^casamento-ana-joao-[a-z0-9]{5}$/);
    expect(prisma.event.findUnique).toHaveBeenCalledTimes(1);
  });

  it('tenta de novo quando o primeiro slug já existe, até achar um livre', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({ id: 'ja-existe' }) // 1ª tentativa colide
      .mockResolvedValueOnce(null); // 2ª tentativa livre

    const slug = await service.generateUniqueSlug('Aniversário da Marina');

    expect(slug).toMatch(/^aniversario-da-marina-[a-z0-9]{5}$/);
    expect(prisma.event.findUnique).toHaveBeenCalledTimes(2);
  });

  it('desiste depois de 5 colisões seguidas', async () => {
    prisma.event.findUnique.mockResolvedValue({ id: 'sempre-existe' });

    await expect(service.generateUniqueSlug('Chá de cozinha')).rejects.toThrow();
    expect(prisma.event.findUnique).toHaveBeenCalledTimes(5);
  });

  it('usa "evento" como base quando o título não vira nenhuma letra/número', async () => {
    prisma.event.findUnique.mockResolvedValue(null);

    const slug = await service.generateUniqueSlug('!!!');

    expect(slug).toMatch(/^evento-[a-z0-9]{5}$/);
  });

  describe('findBySlugForOwner (checagem de ownership)', () => {
    it('lança NotFoundException se o slug não existe', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.findBySlugForOwner('nao-existe', 'dono-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException (não 403) se o evento pertence a outro dono', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'evt-1',
        slug: 'casamento-x7k2',
        ownerId: 'dono-2',
      });

      // dono-1 tentando acessar um evento de dono-2 — mesmo erro de "não existe",
      // pra não revelar que o slug pertence a outra pessoa.
      await expect(service.findBySlugForOwner('casamento-x7k2', 'dono-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna o evento, sem o ownerId, quando o dono bate', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'evt-1',
        slug: 'casamento-x7k2',
        title: 'Casamento Ana & João',
        ownerId: 'dono-1',
      });

      const event = await service.findBySlugForOwner('casamento-x7k2', 'dono-1');

      expect(event).toEqual({ id: 'evt-1', slug: 'casamento-x7k2', title: 'Casamento Ana & João' });
      expect(event).not.toHaveProperty('ownerId');
    });
  });

  describe('update', () => {
    it('não chama prisma.event.update se o dono não bate (ownership falha antes)', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'evt-1',
        slug: 'casamento-x7k2',
        ownerId: 'dono-2',
      });

      await expect(
        service.update('casamento-x7k2', { title: 'Hackeado' }, 'dono-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('atualiza só os campos enviados, quando o dono bate', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'evt-1',
        slug: 'casamento-x7k2',
        ownerId: 'dono-1',
      });
      prisma.event.update.mockResolvedValue({
        id: 'evt-1',
        slug: 'casamento-x7k2',
        title: 'Novo título',
      });

      await service.update('casamento-x7k2', { title: 'Novo título' }, 'dono-1');

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { slug: 'casamento-x7k2' },
        data: { title: 'Novo título' },
        select: expect.any(Object),
      });
    });
  });

  describe('verifyGuestAccess', () => {
    it('lança NotFoundException se o slug não existe', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.verifyGuestAccess('nao-existe', '1234')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança UnauthorizedException com a senha errada', async () => {
      const guestPasswordHash = await bcrypt.hash('senhacerta', 10);
      prisma.event.findUnique.mockResolvedValue({ guestPasswordHash });

      await expect(service.verifyGuestAccess('casamento-x7k2', 'senhaerrada')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('retorna { valid: true } com a senha correta', async () => {
      const guestPasswordHash = await bcrypt.hash('senhacerta', 10);
      prisma.event.findUnique.mockResolvedValue({ guestPasswordHash });

      const result = await service.verifyGuestAccess('casamento-x7k2', 'senhacerta');

      expect(result).toEqual({ valid: true });
    });
  });
});
