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
  // true = o valor desta cota já está no saldo extra (não há mais o que confirmar).
  inExtraFunds: boolean;
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

// Resposta de POST /events/:slug/contributions/:id/confirm (Sprint 5, Dia 2).
export type ConfirmContributionResult = {
  // applied = o valor passou a contar no presente; extra_funds = foi para o saldo extra.
  outcome: 'applied' | 'extra_funds';
  contribution: { id: string; status: 'confirmed' | 'expired'; confirmedAt: string | null };
  extraFund: { amount: number } | null;
  gift: { id: string; title: string; status: string; reservedAmount: number; availableAmount: number };
};

// Mensagens (em português) para os erros do backend nas ações do dono.
export function contributionActionError(status: number, code?: string): string {
  if (status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (status === 404) return 'Cota não encontrada. Atualize a página.';
  if (status === 409) {
    if (code === 'ALREADY_CONFIRMED') return 'Esta cota já foi confirmada (ou já está no saldo extra). Atualize a página.';
    if (code === 'ALREADY_EXPIRED') return 'Esta cota já estava vencida ou cancelada. Atualize a página.';
    if (code === 'CONTRIBUTION_EXPIRED') return 'Esta reserva venceu. Se o Pix caiu mesmo assim, use "Recebi mesmo assim".';
    return 'A cota mudou enquanto você olhava. Atualize a página.';
  }
  if (status === 502) return 'Não foi possível falar com o servidor agora. Tente de novo em instantes.';
  return 'Não foi possível concluir agora. Tente de novo.';
}
