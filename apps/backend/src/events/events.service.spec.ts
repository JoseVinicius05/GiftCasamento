import { EventsService } from './events.service';

describe('EventsService', () => {
  let prisma: { event: { findUnique: jest.Mock } };
  let service: EventsService;

  beforeEach(() => {
    prisma = { event: { findUnique: jest.fn() } };
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
});
