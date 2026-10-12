import type { PrismaService } from '../prisma.service';

// Soma, por presente, das cotas que "seguram" valor: confirmadas, mais as
// pendentes que ainda não passaram das 48h (expiresAt no futuro). Pendente
// vencida não conta, mesmo que o job de expiração ainda não tenha rodado.
//
// Vive num arquivo próprio porque a MESMA regra é usada pela lista do dono
// (GiftsService) e pela lista do convidado (GuestService) — duas cópias da
// regra de saldo, cedo ou tarde, divergem. Valor disponível de um presente =
// price - reservado.
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
