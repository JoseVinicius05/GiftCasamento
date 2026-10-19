'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Gift, Clock3, CircleCheck, History, CreditCard, XCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { firstApiMessage, formatBRL } from '../../lib/gifts';
import type { GuestGift, MyContribution, MyContributionPayment } from '../../lib/guest';
import PixPaymentView from './PixPaymentView';
import ExpensiveGiftsCarousel, {
  type ExpensiveGift,
} from '../../components/ExpensiveGiftsCarousel';

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
  gifts,
}: {
  slug: string;
  contributions: MyContribution[];
  gifts: GuestGift[];
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
  const [showAllContributions, setShowAllContributions] = useState(false);

  const expensiveGifts: ExpensiveGift[] = gifts
    .map((gift) => ({
      id: gift.id,
      title: gift.title,
      price: gift.price,
      imageUrl: gift.imageUrl,
      href: `#presente-${gift.id}`,
    }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 8);



  const INITIAL_VISIBLE_CONTRIBUTIONS = 3;
  const hiddenContributionsCount = Math.max(0, contributions.length - INITIAL_VISIBLE_CONTRIBUTIONS);
  const visibleContributions = showAllContributions
    ? contributions
    : contributions.slice(0, INITIAL_VISIBLE_CONTRIBUTIONS);


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
    pending: 'bg-[#fff3dc] text-[#895d19] border-[#efd5a0]',
    confirmed: 'bg-[#eaf5ee] text-[#316c47] border-[#c5e2ce]',
    expired: 'bg-[#f4eeee] text-[#786967] border-[#e4d6d5]',
  };
  const badgeLabel: Record<MyContribution['status'], string> = {
    pending: 'Aguardando pagamento',
    confirmed: 'Confirmada',
    expired: 'Expirada ou cancelada',
  };

  return (
    <section
      className="relative isolate overflow-hidden px-4 py-10 sm:px-6 sm:py-14"
      aria-labelledby="my-contributions-title"
    >

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[#fff7f8]/75" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-8 -z-10 h-44 w-44 rounded-full bg-[#e8caca]/45 blur-3xl sm:h-64 sm:w-64" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 bottom-0 -z-10 h-52 w-52 rounded-full bg-[#ead6d6]/55 blur-3xl sm:h-72 sm:w-72" />

      <div className="mx-auto grid w-full max-w-7xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
        <div className="min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_24px_70px_rgba(115,77,77,0.14)] backdrop-blur-md sm:rounded-[32px]">
          <div className="relative overflow-hidden border-b border-[#f0dfe2] bg-gradient-to-br from-[#fff0f2] via-[#fff8f8] to-[#f8e8eb] px-5 py-6 sm:px-8 sm:py-8">
            <div aria-hidden="true" className="absolute -right-5 -top-10 h-36 w-36 rounded-full border-[22px] border-white/30 sm:h-48 sm:w-48" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-[#b47b7f] shadow-sm sm:h-14 sm:w-14">
                <Gift size={25} strokeWidth={1.6} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#b47b7f] sm:text-xs sm:tracking-[0.28em]">
                  <Sparkles size={13} /> Sua lista pessoal
                </p>
                <h2 id="my-contributions-title" className="font-serif text-2xl leading-tight text-[#302b28] sm:text-3xl">
                  Minhas contribuições
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#786967] sm:text-base">
                  Acompanhe seus presentes, consulte o Pix e gerencie suas reservas em um só lugar.
                </p>
              </div>
            </div>
            <p className="relative mt-5 rounded-xl border border-white/80 bg-white/60 px-3.5 py-3 text-xs leading-relaxed text-[#786967] sm:text-sm">
              Os anfitriões confirmam o recebimento manualmente. Reservas não confirmadas em 48h expiram e o valor volta a ficar disponível.
            </p>
          </div>

          <div className="p-4 sm:p-6 md:p-8">
            {error && (
              <div role="alert" className="mb-4 break-words rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
                {error}
              </div>
            )}

            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
              <h3 className="text-sm font-semibold text-[#514340] sm:text-base">Seus presentes reservados</h3>
              <span className="shrink-0 rounded-full bg-[#fff0f2] px-3 py-1 text-xs font-semibold text-[#a66c72]">
                {contributions.length} {contributions.length === 1 ? 'reserva' : 'reservas'}
              </span>
            </div>

            {contributions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e8caca] bg-white/70 px-5 py-8 text-center">
                <Gift className="mx-auto text-[#b47b7f]" size={28} />

                <h3 className="mt-3 font-serif text-lg text-[#302b28]">
                  Nenhum presente reservado ainda
                </h3>

                <p className="mt-2 text-sm text-[#786967]">
                  Quando você reservar um presente, ele aparecerá aqui.
                </p>
              </div>
            ) : (

              <ul className="space-y-3 sm:space-y-4">
                {visibleContributions.map((contribution) => {
                  const status = statusOf(contribution);
                  const expiresAt = new Date(contribution.expiresAt);
                  const confirming = confirmCancelId === contribution.id;
                  const cancelling = cancellingId === contribution.id;
                  const StatusIcon = status === 'pending' ? Clock3 : status === 'confirmed' ? CircleCheck : History;

                  return (
                    <li key={contribution.id} data-gift-id={contribution.id} className="group relative overflow-hidden rounded-2xl border border-[#f0dfe2] bg-white/90 shadow-[0_5px_20px_rgba(115,77,77,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#dfb8bd] hover:shadow-[0_12px_30px_rgba(115,77,77,0.10)]">
                      <div aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${status === 'pending' ? 'bg-[#d6a45e]' : status === 'confirmed' ? 'bg-[#78a889]' : 'bg-[#c8b7b5]'}`} />
                      <div className="p-4 pl-5 sm:p-5 sm:pl-6">
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff3f4] text-[#b47b7f]">
                              <Gift size={19} strokeWidth={1.7} />
                            </div>
                            <div className="min-w-0">
                              <p className="break-words font-semibold leading-snug text-[#302b28]">{contribution.giftTitle}</p>
                              <p className="mt-1 text-xl font-bold tracking-tight text-[#b46f76] sm:text-2xl">{formatBRL(contribution.amount)}</p>
                            </div>
                          </div>
                          <span className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${badgeClass[status]}`}>
                            <StatusIcon size={14} />
                            {badgeLabel[status]}
                          </span>
                        </div>

                        {status === 'pending' && now !== null && (
                          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#fff8ed] px-3 py-2.5 text-xs leading-relaxed text-[#80633c] sm:text-sm">
                            <Clock3 size={16} className="mt-0.5 shrink-0" />
                            <p className="break-words">Sua reserva vence em <strong>{formatRemaining(expiresAt.getTime() - now)}</strong> (até {expiresAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}).</p>
                          </div>
                        )}

                        {status === 'pending' && !confirming && (
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => openPayment(contribution)}
                              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#c4777d] to-[#b66b72] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(180,107,114,0.20)] transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-[#c4777d]/25 sm:w-auto"
                            >
                              <CreditCard size={16} /> Ver Pix
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setConfirmCancelId(contribution.id);
                              }}
                              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e8caca] bg-white px-4 py-2.5 text-sm font-semibold text-[#9d646a] transition hover:border-[#c4777d] hover:bg-[#fff5f6] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/15 sm:w-auto"
                            >
                              <XCircle size={16} /> Cancelar reserva
                            </button>
                          </div>
                        )}

                        {status === 'pending' && confirming && (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-[#fffaf1] p-3.5 sm:p-4">
                            <p className="text-sm leading-relaxed text-amber-900">
                              Cancelar a reserva de <strong>{formatBRL(contribution.amount)}</strong>? O valor volta a ficar disponível para outros convidados. <strong>Se você já pagou, não cancele</strong> — fale com os anfitriões.
                            </p>
                            <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                              <button
                                type="button"
                                disabled={cancelling}
                                onClick={() => cancel(contribution)}
                                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c4777d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                              >
                                {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                              </button>
                              <button
                                type="button"
                                disabled={cancelling}
                                onClick={() => setConfirmCancelId(null)}
                                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#e8caca] bg-white px-4 py-2.5 text-sm font-semibold text-[#6d5b58] transition hover:bg-[#fff8fb] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                              >
                                Manter reserva
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>)}

            {hiddenContributionsCount > 0 && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllContributions((current) => !current)}
                  aria-expanded={showAllContributions}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e8caca] bg-white/80 px-4 py-3 text-sm font-semibold text-[#9d646a] shadow-sm transition hover:border-[#c4777d] hover:bg-[#fff5f6] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/15 sm:w-auto sm:min-w-64"
                >
                  {showAllContributions ? (
                    <>
                      <ChevronUp size={17} />
                      Mostrar menos reservas
                    </>
                  ) : (
                    <>
                      <ChevronDown size={17} />
                      Ver mais {hiddenContributionsCount}{' '}
                      {hiddenContributionsCount === 1 ? 'reserva' : 'reservas'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 lg:sticky lg:top-6">
          <ExpensiveGiftsCarousel gifts={expensiveGifts} />
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setPayment(null)}
        aria-labelledby={PAYMENT_TITLE_ID}
        className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-md overflow-x-hidden overflow-y-auto rounded-[28px] border border-[#f0dfe2] bg-[#fffdfd] p-0 text-[#302b28] shadow-[0_24px_80px_rgba(48,43,40,0.22)] backdrop:bg-[#302b28]/45 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)]"
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
          <div className="p-5 text-center sm:p-8">
            <h2 id={PAYMENT_TITLE_ID} className="font-serif text-2xl text-[#302b28] sm:text-3xl">
              Dados de pagamento
            </h2>
            <p className="mt-3 break-words text-sm leading-relaxed text-[#6d5b58] sm:text-base">
              {payment?.status === 'error' ? payment.message : 'Carregando...'}
            </p>
            {payment?.status === 'error' && (
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/20"
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
