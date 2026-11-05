// Teste de CONCORRÊNCIA contra um Postgres de verdade — o critério de aceite
// da Sprint 4: por mais requisições que cheguem ao mesmo tempo, a soma das
// cotas de um presente nunca passa do preço, e as operações que mexem no mesmo
// presente (cota, "comprei pelo link", cancelamento, PATCH de preço, exclusão)
// nunca deixam o presente num estado impossível.
//
// Os testes unitários provam a LÓGICA (com o banco simulado); só o banco de
// verdade prova o LOCK (`SELECT ... FOR UPDATE`). Por isso este arquivo existe.
//
// COMO RODAR (a partir de apps/backend, com o Postgres local de pé):
//   npm run test:integration
// No `npm test` comum ele aparece como "skipped" (precisa de banco).
//
// SEGURANÇA: cria e apaga só as próprias linhas (usuário/evento de teste com
// e-mail/slug aleatórios), mas mesmo assim recusa rodar em produção ou num
// banco remoto, a menos que ALLOW_REMOTE_DB_TESTS=1.
import 'dotenv/config';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GiftsService } from '../gifts/gifts.service';
import { deriveGiftStatus, reservedByGift, toCents } from '../gifts/gift-reservation.util';
import { PrismaService } from '../prisma.service';
import { GuestClaimsService } from './guest-claims.service';
import { GuestContributionsService } from './guest-contributions.service';
import { GuestMyContributionsService } from './guest-my-contributions.service';

const enabled = process.env.RUN_DB_INTEGRATION === '1';
const suite = enabled ? describe : describe.skip;

const N = Number(process.env.CONCURRENCY_N ?? 30);

// Gerador pseudoaleatório com semente fixa: se um cenário falhar, dá pra
// repetir exatamente a mesma sequência de valores.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function statusOf(reason: any): number {
  return typeof reason?.getStatus === 'function' ? reason.getStatus() : 500;
}

// Separa os resultados de Promise.allSettled e acusa qualquer erro que não
// seja um 4xx "esperado" (timeout, deadlock, erro de FK etc. = bug).
// `any`: alguns testes misturam operações de tipos de retorno diferentes no mesmo
// Promise.allSettled (ex.: remover presente + criar cota), e um T único não se aplica.
function summarize(results: PromiseSettledResult<any>[], allowedStatuses: number[] = [404, 409]) {
  const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const unexpected = rejected
    .filter((r) => !allowedStatuses.includes(statusOf(r.reason)))
    .map((r) => `${r.reason?.name ?? 'Error'}: ${r.reason?.message ?? r.reason}`);
  return { fulfilled, rejected, unexpected };
}

suite('Concorrência real no Postgres (reserva de cotas)', () => {
  // Criados no beforeAll (e não aqui): o Jest executa o corpo de um `describe`
  // mesmo quando ele está "skipped", e no `npm test` comum não queremos
  // instanciar o Prisma à toa.
  let prisma: PrismaService;
  let contributions: GuestContributionsService;
  let claims: GuestClaimsService;
  let myContributions: GuestMyContributionsService;

  let userId: string;
  let eventId: string;
  let slug: string;
  let gifts: GiftsService;

  const session = (index: number) => ({ sid: randomUUID(), eventId, name: `Convidado ${index}` });

  async function newGift(price: number, withLink = true) {
    return prisma.gift.create({
      data: {
        eventId,
        title: `Presente de teste R$ ${price}`,
        price,
        priceSource: 'manual',
        productUrl: withLink ? 'https://www.amazon.com.br/dp/B0ABCDEFGH' : null,
      },
    });
  }

  // Soma do que "segura valor" agora (confirmadas + pendentes vivas), lida
  // direto do banco — a mesma regra que a aplicação usa.
  async function reservedNow(giftId: string): Promise<number> {
    return (await reservedByGift(prisma, [giftId])).get(giftId) ?? 0;
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL ?? '';
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(url);
    if (process.env.NODE_ENV === 'production' || (!isLocal && process.env.ALLOW_REMOTE_DB_TESTS !== '1')) {
      throw new Error(
        'Recusado: este teste cria e apaga dados e só roda contra um Postgres LOCAL. ' +
          'Para forçar (por sua conta e risco), defina ALLOW_REMOTE_DB_TESTS=1.',
      );
    }

    prisma = new PrismaService();
    contributions = new GuestContributionsService(prisma);
    claims = new GuestClaimsService(prisma, contributions);
    myContributions = new GuestMyContributionsService(prisma);

    await prisma.$connect();

    const suffix = randomUUID().slice(0, 8);
    const user = await prisma.user.create({
      data: { name: 'Teste Concorrência', email: `concorrencia-${suffix}@example.test`, passwordHash: 'x' },
    });
    userId = user.id;

    const event = await prisma.event.create({
      data: {
        ownerId: userId,
        eventType: 'casamento',
        title: 'Evento de teste de concorrência',
        eventDate: new Date('2030-01-01T00:00:00Z'),
        slug: `concorrencia-${suffix}`,
        guestPasswordHash: 'x',
        pixKey: 'teste@example.com',
      },
    });
    eventId = event.id;
    slug = event.slug;

    // O dono é "achado" sem passar pelo JWT: o que se testa aqui é o banco.
    gifts = new GiftsService(prisma, { findBySlugForOwner: async () => ({ id: eventId }) } as any);
  });

  afterAll(async () => {
    if (!prisma) return; // o beforeAll recusou rodar (banco remoto/produção)

    // Ordem das FKs: cotas e fundo extra → presentes → evento → usuário.
    if (eventId) {
      await prisma.contribution.deleteMany({ where: { gift: { eventId } } });
      await prisma.eventExtraFunds.deleteMany({ where: { eventId } });
      await prisma.gift.deleteMany({ where: { eventId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it(`${N} convidados reservando R$ 10 de um presente de R$ 100: exatamente 10 passam`, async () => {
    const gift = await newGift(100);

    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => contributions.create(slug, gift.id, session(i), 10)),
    );
    const { fulfilled, rejected, unexpected } = summarize(results);

    expect(unexpected).toEqual([]);
    expect(fulfilled).toHaveLength(10);
    expect(rejected).toHaveLength(N - 10);
    expect(await reservedNow(gift.id)).toBe(100);

    const stored = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    expect(stored.status).toBe('fully_funded');
  });

  it('valores variados em paralelo: a soma nunca passa do preço e o status gravado bate com o saldo', async () => {
    const price = 500;
    const gift = await newGift(price);
    const random = seeded(42);

    const amounts = Array.from({ length: N + 10 }, () => 10 + Math.floor(random() * 111)); // R$ 10 a R$ 120
    const results = await Promise.allSettled(
      amounts.map((amount, i) => contributions.create(slug, gift.id, session(i), amount)),
    );
    const { fulfilled, unexpected } = summarize(results);

    expect(unexpected).toEqual([]);

    const accepted = fulfilled.reduce((sum, r: any) => sum + toCents(r.value.contribution.amount), 0);
    const reserved = await reservedNow(gift.id);

    expect(toCents(reserved)).toBe(accepted); // o que o app aceitou é exatamente o que está no banco
    expect(toCents(reserved)).toBeLessThanOrEqual(toCents(price)); // e NUNCA passa do preço

    const stored = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    expect(stored.status).toBe(deriveGiftStatus('available', price, reserved));
  });

  it('pagar tudo por Pix em paralelo: só um leva o presente', async () => {
    const gift = await newGift(300);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => claims.claim(slug, gift.id, session(i), 'pix')),
    );
    const { fulfilled, unexpected } = summarize(results);

    expect(unexpected).toEqual([]);
    expect(fulfilled).toHaveLength(1);
    expect(await reservedNow(gift.id)).toBe(300);
    expect(await prisma.contribution.count({ where: { giftId: gift.id } })).toBe(1);
  });

  it('cotas × "comprei pelo link" no mesmo presente: estado final sempre coerente', async () => {
    const gift = await newGift(200);

    const operations = [
      ...Array.from({ length: 10 }, (_, i) => contributions.create(slug, gift.id, session(i), 20)),
      ...Array.from({ length: 5 }, (_, i) => claims.claim(slug, gift.id, session(100 + i), 'link')),
    ];
    const results = await Promise.allSettled(operations);
    const { unexpected } = summarize(results);

    expect(unexpected).toEqual([]);

    const linkWins = results.slice(10).filter((r) => r.status === 'fulfilled').length;
    const stored = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    const reserved = await reservedNow(gift.id);

    expect(linkWins).toBeLessThanOrEqual(1); // nunca duas compras "pelo link" no mesmo presente
    expect(toCents(reserved)).toBeLessThanOrEqual(toCents(200));

    if (linkWins === 1) {
      expect(stored.status).toBe('purchased_via_link');
      expect(stored.purchasedViaLinkBy).toMatch(/^Convidado 10\d$/);
    } else {
      // Ninguém fechou pelo link: as cotas encheram o presente.
      expect(stored.status).toBe('fully_funded');
      expect(toCents(reserved)).toBe(toCents(200));
    }
  });

  it('cancelar cotas × criar cotas ao mesmo tempo: a soma segue ≤ preço e o status fecha com o saldo', async () => {
    const price = 100;
    const gift = await newGift(price);

    const sessions = Array.from({ length: 5 }, (_, i) => session(i));
    const created = [];
    for (const guest of sessions) {
      created.push(await contributions.create(slug, gift.id, guest, 10));
    }

    const results = await Promise.allSettled([
      ...created.map((c, i) => myContributions.cancel(slug, c.contribution.id, sessions[i])),
      ...Array.from({ length: 20 }, (_, i) => contributions.create(slug, gift.id, session(50 + i), 10)),
    ]);
    const { unexpected } = summarize(results);

    expect(unexpected).toEqual([]);

    const reserved = await reservedNow(gift.id);
    expect(toCents(reserved)).toBeLessThanOrEqual(toCents(price));

    const stored = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    expect(stored.status).toBe(deriveGiftStatus('available', price, reserved));
  });

  it('PATCH de preço × cotas: o preço final nunca fica abaixo do reservado', async () => {
    const gift = await newGift(100);

    const results = await Promise.allSettled([
      ...Array.from({ length: 10 }, (_, i) => contributions.create(slug, gift.id, session(i), 10)),
      gifts.update(slug, gift.id, { price: 40 }, userId),
    ]);
    const { unexpected } = summarize(results);

    expect(unexpected).toEqual([]);

    const stored = await prisma.gift.findUniqueOrThrow({ where: { id: gift.id } });
    const reserved = await reservedNow(gift.id);

    // A janela que a Sprint 3 deixou aberta: sem o lock, dava pra baixar o
    // preço para 40 com R$ 100 já reservados.
    expect(toCents(reserved)).toBeLessThanOrEqual(toCents(Number(stored.price)));
  });

  it('excluir o presente × cotas: ou apaga (e as cotas levam 404), ou recusa (409) — nunca erro de FK', async () => {
    const gift = await newGift(100);

    const results = await Promise.allSettled([
      gifts.remove(slug, gift.id, userId),
      ...Array.from({ length: 10 }, (_, i) => contributions.create(slug, gift.id, session(i), 10)),
    ]);
    const { unexpected } = summarize(results, [404, 409]);

    expect(unexpected).toEqual([]);

    const removed = results[0].status === 'fulfilled';
    const stillThere = await prisma.gift.findUnique({ where: { id: gift.id } });
    const contributionCount = await prisma.contribution.count({ where: { giftId: gift.id } });

    if (removed) {
      expect(stillThere).toBeNull();
      expect(contributionCount).toBe(0);
      results.slice(1).forEach((r) => {
        expect(r.status).toBe('rejected');
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(NotFoundException);
      });
    } else {
      expect(stillThere).not.toBeNull();
      expect((results[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    }
  });
});
