import type { PrismaService } from '../prisma.service';

// Valor mínimo de uma cota: R$ 10,00 — ou o que restar do presente, se for
// menos que isso (senão o último pedacinho nunca poderia ser pago). Em
// centavos, como todo o cálculo de saldo (evita erro de ponto flutuante).
export const MIN_CONTRIBUTION_CENTS = 1000;

// Estados que NÃO derivam das cotas: o presente já foi resolvido por fora
// (comprado pelo link) ou fechado pelo dono. Nunca voltam a aceitar cotas.
const TERMINAL_STATUSES = new Set(['purchased_via_link', 'confirmed']);

// Decimal do Prisma / número / string → centavos inteiros.
export function toCents(value: number | string | { toString(): string }): number {
  return Math.round(Number(value.toString()) * 100);
}

// Soma, por presente, das cotas que "seguram" valor: confirmadas, mais as
// pendentes que ainda não passaram das 48h (expiresAt no futuro). Pendente
// vencida não conta, mesmo que ninguém tenha mexido no presente depois.
//
// Vive num arquivo próprio porque a MESMA regra é usada pela lista do dono
// (GiftsService), pela lista do convidado (GuestService) e pela criação de
// cota (GuestContributionsService) — cópias da regra de saldo divergem.
// Valor disponível de um presente = price - reservado.
//
// Aceita o PrismaService OU o client de uma transação ($transaction): a
// criação de cota precisa ler o reservado DENTRO da transação, já com a linha
// do presente travada.
export async function reservedByGift(
  prisma: Pick<PrismaService, 'contribution'>,
  giftIds: string[],
): Promise<Map<string, number>> {
  if (giftIds.length === 0) return new Map();

  const rows = await prisma.contribution.groupBy({
    by: ['giftId'],
    where: {
      giftId: { in: giftIds },
      OR: [{ status: 'confirmed' }, { status: 'pending', expiresAt: { gt: new Date() } }],
    },
    _sum: { amount: true },
  });

  return new Map(rows.map((row: any) => [row.giftId, Number(row._sum.amount ?? 0)]));
}

// Status "de verdade" do presente, calculado na hora a partir das cotas.
//
// O `status` gravado no banco só é atualizado quando alguém cria uma cota; uma
// cota pendente que EXPIRA não dispara nada. Sem isso, um presente com todas
// as cotas vencidas continuaria "garantido" na tela. Por isso o convidado vê
// este valor derivado, e não o gravado (expiração preguiçosa, sem job).
export function deriveGiftStatus(
  storedStatus: string,
  price: number | string | { toString(): string },
  reserved: number,
): string {
  if (TERMINAL_STATUSES.has(storedStatus)) return storedStatus;

  const reservedCents = toCents(reserved);
  if (reservedCents <= 0) return 'available';
  return reservedCents >= toCents(price) ? 'fully_funded' : 'partially_funded';
}

// Menor cota aceita agora: R$ 10 ou o restante, o que for menor.
export function minContributionCents(availableCents: number): number {
  return Math.min(MIN_CONTRIBUTION_CENTS, availableCents);
}

export function isTerminalGiftStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
