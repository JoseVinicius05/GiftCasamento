// Tipos das cotas vistas pelo DONO (GET /events/:slug/contributions e /summary).

export type OwnerContributionStatus = 'pending' | 'expired' | 'confirmed';

export type OwnerContribution = {
  id: string;
  // Mesmo texto do txid do QR Code: é o que o dono procura no extrato.
  reference: string;
  giftId: string;
  giftTitle: string;
  giftImageUrl: string | null;
  // Nome auto-declarado pelo convidado (não verificado).
  guestName: string;
  amount: number;
  // EFETIVO: pendente com prazo vencido já chega como 'expired'. Não
  // diferencia "venceu" de "o convidado cancelou" (os dois são 'expired').
  status: OwnerContributionStatus;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
};

type Bucket = { count: number; amount: number };

export type ContributionsSummary = {
  contributions: { confirmed: Bucket; pending: Bucket; expired: Bucket };
  extraFunds: Bucket;
  gifts: { total: number; purchasedViaLink: number };
};

export const CONTRIBUTION_STATUS_LABEL: Record<OwnerContributionStatus, string> = {
  pending: 'Aguardando pagamento',
  expired: 'Vencida ou cancelada',
  confirmed: 'Confirmada',
};

// Data e hora com fuso FIXO: o mesmo texto sai no servidor e no navegador
// (sem erro de hidratação) e o dono sempre vê o horário de Brasília.
export function formatDateTimeBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
