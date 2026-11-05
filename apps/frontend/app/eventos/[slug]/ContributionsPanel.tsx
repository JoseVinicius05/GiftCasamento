'use client';

import { useEffect, useState } from 'react';
import { Check, Clock3, Copy, HandCoins, PiggyBank, ReceiptText, ShoppingBag } from 'lucide-react';
import { formatBRL } from '../../../lib/gifts';
import {
  CONTRIBUTION_STATUS_LABEL,
  formatDateTimeBR,
  type ContributionsSummary,
  type OwnerContribution,
  type OwnerContributionStatus,
} from '../../../lib/contributions';

// Painel de cotas do DONO (Sprint 5, Dia 1: somente leitura). Mostra quem
// reservou o quê, quando vence e a referência pra achar o Pix no extrato.
// Confirmar/rejeitar chegam no Dia 2.

type Filter = 'all' | OwnerContributionStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Aguardando' },
  { key: 'expired', label: 'Vencidas' },
  { key: 'confirmed', label: 'Confirmadas' },
  { key: 'all', label: 'Todas' },
];

const BADGE_CLASS: Record<OwnerContributionStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  expired: 'border-[#e8dcdc] bg-[#f6f1f1] text-[#827573]',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão da área de transferência: a referência segue visível.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar referência"
      className="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md border border-[#eadcdc] bg-white px-2 py-1 font-mono text-[11px] text-[#6d5b58] transition hover:bg-[#fff0f1] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20"
    >
      <span className="truncate">{value}</span>
      {copied ? <Check size={12} className="shrink-0" /> : <Copy size={12} className="shrink-0" />}
    </button>
  );
}

function SummaryCard({
  icon,
  label,
  amount,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  amount: number;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#f0e3e3] bg-[#fffaf9] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-[#b47b7f]">
        {icon}
        <p className="truncate text-xs font-semibold text-[#968986]">{label}</p>
      </div>
      <p className="mt-2 break-words text-lg font-bold text-[#302b28] sm:text-xl">{formatBRL(amount)}</p>
      <p className="mt-0.5 text-xs text-[#968986]">{detail}</p>
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function ContributionsPanel({
  contributions,
  summary,
  loadFailed,
}: {
  contributions: OwnerContribution[];
  summary: ContributionsSummary | null;
  loadFailed: boolean;
}) {
  const hasPending = contributions.some((item) => item.status === 'pending');
  const [filter, setFilter] = useState<Filter>(hasPending ? 'pending' : 'all');

  // O relógio só existe depois que a página carrega no navegador: o servidor e
  // o navegador renderizariam contagens diferentes e dariam erro de hidratação.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const counts: Record<Filter, number> = {
    all: contributions.length,
    pending: contributions.filter((item) => item.status === 'pending').length,
    expired: contributions.filter((item) => item.status === 'expired').length,
    confirmed: contributions.filter((item) => item.status === 'confirmed').length,
  };

  // Enquanto a página está aberta, uma pendente pode vencer sem recarregar.
  function statusOf(item: OwnerContribution): OwnerContributionStatus {
    if (item.status === 'pending' && now !== null && new Date(item.expiresAt).getTime() <= now) {
      return 'expired';
    }
    return item.status;
  }

  const visible = filter === 'all' ? contributions : contributions.filter((item) => item.status === filter);

  return (
    <section
      aria-labelledby="contributions-title"
      className="min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_16px_45px_rgba(115,77,77,0.07)] backdrop-blur-xl sm:rounded-3xl sm:p-6 md:p-8"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0f1] text-[#b47b7f]">
          <HandCoins size={20} />
        </div>
        <div className="min-w-0">
          <h2 id="contributions-title" className="font-serif text-2xl font-bold text-[#302b28] sm:text-3xl">
            Cotas e pagamentos
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#827573]">
            Compare o valor, o horário e o nome com o extrato do seu banco; a <strong>referência</strong> é o
            código que vai no QR Code do Pix. A confirmação do recebimento será liberada em breve.
          </p>
        </div>
      </div>

      {loadFailed && (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Não foi possível carregar as cotas agora. Atualize a página em instantes.
        </div>
      )}

      {summary && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              icon={<Check size={15} />}
              label="Confirmado"
              amount={summary.contributions.confirmed.amount}
              detail={plural(summary.contributions.confirmed.count, 'cota', 'cotas')}
            />
            <SummaryCard
              icon={<Clock3 size={15} />}
              label="Aguardando pagamento"
              amount={summary.contributions.pending.amount}
              detail={plural(summary.contributions.pending.count, 'cota', 'cotas')}
            />
            <SummaryCard
              icon={<ReceiptText size={15} />}
              label="Vencidas ou canceladas"
              amount={summary.contributions.expired.amount}
              detail={plural(summary.contributions.expired.count, 'cota', 'cotas')}
            />
            <SummaryCard
              icon={<PiggyBank size={15} />}
              label="Saldo extra"
              amount={summary.extraFunds.amount}
              detail={plural(summary.extraFunds.count, 'lançamento', 'lançamentos')}
            />
          </div>

          {summary.gifts.purchasedViaLink > 0 && (
            <p className="mt-3 flex items-center gap-2 text-xs text-[#827573]">
              <ShoppingBag size={14} className="shrink-0 text-[#b47b7f]" />
              {plural(summary.gifts.purchasedViaLink, 'presente comprado', 'presentes comprados')} pelo link da
              loja (de {summary.gifts.total}).
            </p>
          )}
        </>
      )}

      {!loadFailed && (
        <>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar cotas por situação">
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(key)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 ${
                    active
                      ? 'border-[#c4777d] bg-[#c4777d] text-white'
                      : 'border-[#e8caca] bg-white text-[#9d646a] hover:bg-[#fff0f1]'
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/25' : 'bg-[#f6ecec]'}`}>
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[#e8caca] px-5 py-8 text-center text-sm text-[#827573]">
              {contributions.length === 0
                ? 'Nenhuma cota reservada ainda. Quando um convidado reservar, ela aparece aqui.'
                : 'Nenhuma cota nesta situação.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visible.map((item) => {
                const status = statusOf(item);

                return (
                  <li key={item.id} className="min-w-0 rounded-2xl border border-[#f0e3e3] bg-[#fffaf9] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-[#302b28]">{item.guestName}</p>
                        <p className="mt-0.5 break-words text-sm text-[#827573]">{item.giftTitle}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <p className="text-lg font-bold text-[#c4777d]">{formatBRL(item.amount)}</p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${BADGE_CLASS[status]}`}
                        >
                          {CONTRIBUTION_STATUS_LABEL[status]}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#968986]">
                      <span>Reservada em {formatDateTimeBR(item.createdAt)}</span>

                      {status === 'pending' && (
                        <span className="font-medium text-amber-700">
                          Vence em {formatDateTimeBR(item.expiresAt)}
                          {now !== null && ` (faltam ${formatRemaining(new Date(item.expiresAt).getTime() - now)})`}
                        </span>
                      )}
                      {status === 'expired' && <span>Venceu em {formatDateTimeBR(item.expiresAt)}</span>}
                      {status === 'confirmed' && item.confirmedAt && (
                        <span className="font-medium text-emerald-700">
                          Confirmada em {formatDateTimeBR(item.confirmedAt)}
                        </span>
                      )}

                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        Referência <CopyReference value={item.reference} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
