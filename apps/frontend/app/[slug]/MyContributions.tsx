'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { firstApiMessage, formatBRL } from '../../lib/gifts';
import type { MyContribution, MyContributionPayment } from '../../lib/guest';
import PixPaymentView from './PixPaymentView';

// "Minhas contribuições": as cotas que ESTA sessão de convidado reservou.
// Enquanto estiver pendente (até 48h) dá pra reabrir o Pix e cancelar;
// confirmada ou expirada/cancelada só aparece como histórico.

type PaymentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MyContributionPayment };

const PAYMENT_TITLE_ID = 'my-contribution-payment-title';

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export default function MyContributions({
  slug,
  contributions,
}: {
  slug: string;
  contributions: MyContribution[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // `now` só existe depois que a página carrega no navegador. Os textos que
  // dependem do relógio (contagem regressiva, prazo) só aparecem a partir
  // daí — o servidor e o navegador renderizariam horas diferentes e dariam
  // erro de hidratação.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (contributions.length === 0) return null;

  function statusOf(contribution: MyContribution): MyContribution['status'] {
    // Enquanto a página está aberta, uma cota pode vencer sem recarregar.
    if (
      contribution.status === 'pending' &&
      now !== null &&
      new Date(contribution.expiresAt).getTime() <= now
    ) {
      return 'expired';
    }
    return contribution.status;
  }

  async function openPayment(contribution: MyContribution) {
    setError(null);
    setPayment({ status: 'loading' });
    dialogRef.current?.showModal();

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(slug)}/contributions/${encodeURIComponent(contribution.id)}/payment`,
      );
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setPayment({ status: 'ready', data: data as MyContributionPayment });
        return;
      }

      if (response.status === 401) {
        // Sessão vencida: fecha e deixa a página mostrar a tela de entrada.
        dialogRef.current?.close();
        router.refresh();
        return;
      }

      setPayment({
        status: 'error',
        message: firstApiMessage(data, 'Não foi possível carregar os dados de pagamento agora.'),
      });
      // 409: a cota mudou (confirmada/expirada) — atualiza a lista atrás do modal.
      if (response.status === 409) router.refresh();
    } catch {
      setPayment({
        status: 'error',
        message: 'Não foi possível conectar ao servidor. Tente novamente em instantes.',
      });
    }
  }

  async function cancel(contribution: MyContribution) {
    setError(null);
    setCancellingId(contribution.id);

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(slug)}/contributions/${encodeURIComponent(contribution.id)}`,
        { method: 'DELETE' },
      );
      const data = await response.json().catch(() => ({}));

      if (response.ok || response.status === 401) {
        setConfirmCancelId(null);
        router.refresh();
        return;
      }

      if (response.status === 409) {
        // Já confirmada/expirada: mostra o motivo e atualiza a lista.
        setError(firstApiMessage(data, 'Esta reserva não pode mais ser cancelada.'));
        setConfirmCancelId(null);
        router.refresh();
        return;
      }

      if (response.status === 429) {
        setError('Muitas tentativas seguidas. Aguarde um minuto e tente de novo.');
        return;
      }

      setError(firstApiMessage(data, 'Não foi possível cancelar agora. Tente novamente em instantes.'));
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setCancellingId(null);
    }
  }

  const badgeClass: Record<MyContribution['status'], string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    expired: 'bg-[#f6f1f1] text-[#827573] border-[#e8dcdc]',
  };
  const badgeLabel: Record<MyContribution['status'], string> = {
    pending: 'Aguardando pagamento',
    confirmed: 'Confirmada',
    expired: 'Expirada ou cancelada',
  };

  return (
    <section className="px-4 py-10 sm:px-6" aria-labelledby="my-contributions-title">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#f0dfe2] bg-white p-5 shadow-sm sm:p-7">
        <h2 id="my-contributions-title" className="font-serif text-2xl text-[#302b28]">
          Minhas contribuições
        </h2>
        <p className="mt-1 text-sm text-[#827573]">
          Os anfitriões confirmam o recebimento manualmente. Reservas não confirmadas em 48h expiram e
          o valor volta a ficar disponível.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <ul className="mt-5 space-y-3">
          {contributions.map((contribution) => {
            const status = statusOf(contribution);
            const expiresAt = new Date(contribution.expiresAt);
            const confirming = confirmCancelId === contribution.id;
            const cancelling = cancellingId === contribution.id;

            return (
              <li key={contribution.id} className="rounded-2xl border border-[#f0dfe2] bg-[#fffafa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-[#302b28]">{contribution.giftTitle}</p>
                    <p className="mt-0.5 text-lg font-bold text-[#c4777d]">{formatBRL(contribution.amount)}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass[status]}`}
                  >
                    {badgeLabel[status]}
                  </span>
                </div>

                {status === 'pending' && now !== null && (
                  <p className="mt-2 text-xs text-[#827573]">
                    A reserva vale por mais <strong>{formatRemaining(expiresAt.getTime() - now)}</strong> (até{' '}
                    {expiresAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}).
                  </p>
                )}

                {status === 'pending' && !confirming && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPayment(contribution)}
                      className="min-h-9 rounded-lg bg-[#c4777d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b66b72]"
                    >
                      Ver Pix
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setConfirmCancelId(contribution.id);
                      }}
                      className="min-h-9 rounded-lg border border-[#e8caca] bg-white px-4 py-2 text-sm font-semibold text-[#9d646a] transition hover:bg-[#fff0f1]"
                    >
                      Cancelar reserva
                    </button>
                  </div>
                )}

                {status === 'pending' && confirming && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-800">
                      Cancelar a reserva de <strong>{formatBRL(contribution.amount)}</strong>? O valor volta a
                      ficar disponível para outros convidados. <strong>Se você já pagou, não cancele</strong>
                      — fale com os anfitriões.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={() => cancel(contribution)}
                        className="min-h-9 rounded-lg bg-[#c4777d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b66b72] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                      </button>
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={() => setConfirmCancelId(null)}
                        className="min-h-9 rounded-lg border border-[#e8caca] bg-white px-4 py-2 text-sm font-semibold text-[#6d5b58] transition hover:bg-[#fff8fb] disabled:opacity-60"
                      >
                        Manter
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setPayment(null)}
        aria-labelledby={PAYMENT_TITLE_ID}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-0 text-[#302b28] shadow-2xl backdrop:bg-black/40"
      >
        {payment?.status === 'ready' && (
          <PixPaymentView
            titleId={PAYMENT_TITLE_ID}
            reopened
            giftTitle={payment.data.gift.title}
            amount={payment.data.contribution.amount}
            expiresAt={payment.data.contribution.expiresAt}
            pixKey={payment.data.payment.pixKey}
            pixPayload={payment.data.payment.pixPayload}
            onClose={() => dialogRef.current?.close()}
          />
        )}

        {payment?.status !== 'ready' && (
          <div className="p-6 text-center sm:p-8">
            <h2 id={PAYMENT_TITLE_ID} className="font-serif text-2xl">
              Dados de pagamento
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#6d5b58]">
              {payment?.status === 'error' ? payment.message : 'Carregando...'}
            </p>
            {payment?.status === 'error' && (
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="mt-6 min-h-11 w-full rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72]"
              >
                Fechar
              </button>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
