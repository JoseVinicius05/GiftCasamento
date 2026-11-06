'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock3, Copy, HandCoins, Loader2, PiggyBank, ReceiptText, ShoppingBag, X } from 'lucide-react';
import { formatBRL } from '../../../lib/gifts';
import {
  CONTRIBUTION_STATUS_LABEL,
  contributionActionError,
  formatDateTimeBR,
  type ConfirmContributionResult,
  type ContributionsSummary,
  type OwnerContribution,
  type OwnerContributionStatus,
} from '../../../lib/contributions';

// Painel de cotas do DONO. Dia 1: quem reservou o quê, quando vence e a
// referência pra achar o Pix no extrato. Dia 2: confirmar ("Recebi"),
// "Recebi mesmo assim" (cota vencida/cancelada) e "Não recebi" — sempre com
// uma confirmação em cima, porque não existe "desconfirmar" cota.

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

type Action = 'confirm' | 'confirm-expired' | 'reject';
type Feedback = { kind: 'success' | 'error'; text: string };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function successMessage(item: OwnerContribution, action: Action, data: unknown): string {
  const who = `${formatBRL(item.amount)} de ${item.guestName}`;

  if (action === 'reject') {
    return `Reserva de ${who} encerrada. O valor voltou a ficar disponível no presente.`;
  }

  const result = data as ConfirmContributionResult;
  if (result?.outcome === 'extra_funds') {
    return result.contribution?.status === 'confirmed'
      ? `Cota de ${who} confirmada. Como o presente já estava fechado, o valor foi para o saldo extra.`
      : `Pix de ${who} registrado no saldo extra: o presente já estava coberto e o valor não cabia mais nele.`;
  }
  return `Cota de ${who} confirmada. O valor já conta no presente.`;
}

export default function ContributionsPanel({
  slug,
  contributions,
  summary,
  loadFailed,
}: {
  slug: string;
  contributions: OwnerContribution[];
  summary: ContributionsSummary | null;
  loadFailed: boolean;
}) {
  const router = useRouter();
  const hasPending = contributions.some((item) => item.status === 'pending');
  const [filter, setFilter] = useState<Filter>(hasPending ? 'pending' : 'all');

  // Uma ação aberta por vez: qual cota e qual ação está pedindo confirmação,
  // qual está sendo enviada, e o resultado (sucesso/erro) da última.
  const [asking, setAsking] = useState<{ id: string; action: Action } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

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

  async function runAction(item: OwnerContribution, action: Action) {
    setBusyId(item.id);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(slug)}/contributions/${encodeURIComponent(item.id)}/${
          action === 'reject' ? 'reject' : 'confirm'
        }`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action === 'confirm-expired' ? { acceptExpired: true } : {}),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({ kind: 'error', text: contributionActionError(response.status, data?.code) });
        setAsking(null);
        // Estado mudou por baixo (409/404): atualiza pra mostrar a situação real.
        if (response.status === 409 || response.status === 404) router.refresh();
        return;
      }

      setFeedback({ kind: 'success', text: successMessage(item, action, data) });
      setAsking(null);
      router.refresh();
    } catch {
      setFeedback({ kind: 'error', text: contributionActionError(502) });
    } finally {
      setBusyId(null);
    }
  }

  const visible = filter === 'all' ? contributions : contributions.filter((item) => item.status === filter);

  // Botões e confirmação de cada cota. Confirmada (ou com o valor já no saldo
  // extra) não tem ação: não existe "desconfirmar" na Sprint 5.
  function renderActions(item: OwnerContribution, status: OwnerContributionStatus) {
    const busy = busyId === item.id;
    const current = asking?.id === item.id ? asking.action : null;
    const who = `${formatBRL(item.amount)} de ${item.guestName}`;

    if (status === 'confirmed') {
      return item.inExtraFunds ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#827573]">
          <PiggyBank size={14} className="shrink-0 text-[#b47b7f]" />
          Este valor está no saldo extra (o presente já estava fechado).
        </p>
      ) : null;
    }

    if (status === 'expired' && item.inExtraFunds) {
      return (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#827573]">
          <PiggyBank size={14} className="shrink-0 text-[#b47b7f]" />
          Pix recebido depois do prazo: o valor foi para o saldo extra.
        </p>
      );
    }

    if (current) {
      const copy: Record<Action, { title: string; body: string; yes: string; danger?: boolean }> = {
        confirm: {
          title: `Confirmar o recebimento de ${who}?`,
          body: 'Confira no extrato do banco (valor, horário e nome). Depois de confirmada, a cota não pode ser desfeita.',
          yes: 'Sim, recebi',
        },
        'confirm-expired': {
          title: `Recebi mesmo assim: ${who}`,
          body: 'A reserva já tinha vencido. Se o presente ainda comportar o valor, ele entra como confirmado no presente. Se outros convidados já o cobriram (ou ele foi comprado), o valor vai para o saldo extra e o presente não passa do preço.',
          yes: 'Sim, o Pix caiu',
        },
        reject: {
          title: `Não recebi ${who}?`,
          body: 'A reserva é encerrada e o valor volta a ficar disponível para outros convidados. Se o Pix cair depois, ainda dá para usar "Recebi mesmo assim".',
          yes: 'Sim, não recebi',
          danger: true,
        },
      };
      const text = copy[current];

      return (
        <div role="group" aria-label={text.title} className="mt-3 rounded-xl border border-[#eadcdc] bg-white p-3.5">
          <p className="text-sm font-semibold text-[#302b28]">{text.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[#827573]">{text.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(item, current)}
              className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 disabled:opacity-60 ${
                text.danger ? 'bg-[#9d646a] hover:bg-[#875358]' : 'bg-[#c4777d] hover:bg-[#b0666c]'
              }`}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? 'Enviando...' : text.yes}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAsking(null)}
              className="inline-flex min-h-9 items-center rounded-full border border-[#e8caca] bg-white px-4 py-1.5 text-sm font-semibold text-[#9d646a] transition hover:bg-[#fff0f1] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 disabled:opacity-60"
            >
              Voltar
            </button>
          </div>
        </div>
      );
    }

    const base =
      'inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 disabled:opacity-60';
    const primary = `${base} bg-[#c4777d] text-white hover:bg-[#b0666c]`;
    const secondary = `${base} border border-[#e8caca] bg-white text-[#9d646a] hover:bg-[#fff0f1]`;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {status === 'pending' ? (
          <>
            <button type="button" disabled={busyId !== null} onClick={() => { setFeedback(null); setAsking({ id: item.id, action: 'confirm' }); }} className={primary}>
              <Check size={14} /> Recebi
            </button>
            <button type="button" disabled={busyId !== null} onClick={() => { setFeedback(null); setAsking({ id: item.id, action: 'reject' }); }} className={secondary}>
              <X size={14} /> Não recebi
            </button>
          </>
        ) : (
          <button type="button" disabled={busyId !== null} onClick={() => { setFeedback(null); setAsking({ id: item.id, action: 'confirm-expired' }); }} className={secondary}>
            <Check size={14} /> Recebi mesmo assim
          </button>
        )}
      </div>
    );
  }

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
            código que vai no QR Code do Pix. Quando o Pix cair na sua conta, toque em <strong>Recebi</strong>.
          </p>
        </div>
      </div>

      {loadFailed && (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Não foi possível carregar as cotas agora. Atualize a página em instantes.
        </div>
      )}

      {feedback && (
        <div
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={`mt-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <p className="min-w-0 break-words">{feedback.text}</p>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Fechar aviso"
            className="shrink-0 rounded-md p-0.5 hover:bg-black/5 focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20"
          >
            <X size={14} />
          </button>
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

                    {renderActions(item, status)}
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
