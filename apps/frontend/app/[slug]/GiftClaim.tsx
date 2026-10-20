
'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Gift as GiftIcon,
  Heart,
  ShoppingBag,
  BanknoteCheck,
} from 'lucide-react';
import { firstApiMessage, formatBRL } from '../../lib/gifts';
import type {
  ClaimLinkResult,
  ClaimPixResult,
  GuestGift,
} from '../../lib/guest';
import PixPaymentView from './PixPaymentView';

type Step = 'choose' | 'payment' | 'link' | 'link-done';

export default function GiftClaim({
  slug,
  gift,
}: {
  slug: string;
  gift: GuestGift;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [step, setStep] = useState<Step>('choose');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixResult, setPixResult] = useState<ClaimPixResult | null>(null);
  const [linkResult, setLinkResult] = useState<ClaimLinkResult | null>(null);

  const hasShares = gift.reservedAmount > 0;
  const titleId = `claim-title-${gift.id}`;

  function openDialog() {
    setStep('choose');
    setError(null);
    setPixResult(null);
    setLinkResult(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleClosed() {
    if (pixResult || linkResult) router.refresh();
  }

  async function claim(method: 'pix' | 'link') {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(slug)}/gifts/${encodeURIComponent(gift.id)}/claim`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 201) {
        if (method === 'pix') {
          setPixResult(data as ClaimPixResult);
          setStep('payment');
        } else {
          setLinkResult(data as ClaimLinkResult);
          setStep('link-done');
        }
        return;
      }

      if (response.status === 401) {
        closeDialog();
        router.refresh();
        return;
      }

      if (response.status === 409) {
        setError(
          firstApiMessage(
            data,
            'Este presente mudou. Atualizamos a lista.',
          ),
        );
        router.refresh();
        return;
      }

      if (response.status === 429) {
        setError(
          'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.',
        );
        return;
      }

      setError(
        firstApiMessage(
          data,
          'Não foi possível concluir agora. Tente novamente em instantes.',
        ),
      );
    } catch {
      setError(
        'Não foi possível conectar ao servidor. Tente novamente em instantes.',
      );
    } finally {
      setLoading(false);
    }
  }

  const errorBox = error && (
    <div
      role="alert"
      className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700"
    >
      {error}
    </div>
  );

  const optionClass =
    'group flex w-full items-start gap-3.5 rounded-2xl border border-[#efdddf] bg-white p-4 text-left shadow-[0_5px_18px_rgba(95,63,65,0.045)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d9aeb4] hover:bg-[#fffafa] hover:shadow-[0_10px_26px_rgba(95,63,65,0.09)] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/15 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-4 sm:p-5';

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#c4777d] px-4 py-3 text-sm font-bold text-white shadow-[0_5px_14px_rgba(180,123,127,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b66b72] hover:shadow-[0_8px_20px_rgba(180,123,127,0.28)] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/25 active:translate-y-0"
      >
        <BanknoteCheck
          size={16}
          className="transition-transform duration-200 group-hover:scale-110"
        />
        {hasShares ? 'Completar o presente' : 'Presentear por completo'}
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClosed}
        aria-labelledby={titleId}
        className="m-auto max-h-[min(92dvh,780px)] w-[calc(100%-1rem)] max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.75rem] border border-[#efdddf] bg-[#fffdfc] p-0 text-[#302b28] shadow-[0_24px_80px_rgba(76,45,48,0.24)] backdrop:bg-[#302b28]/45 sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)]"
      >
        {step === 'choose' && (
          <div className="relative overflow-hidden p-5 sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-[#f4dfe1]/60 blur-3xl"
            />

            <div className="relative mb-5 flex items-start gap-3.5 sm:mb-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#b47b7f] ring-1 ring-[#f1d9dc]">
                <GiftIcon size={21} strokeWidth={1.6} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a96f75]">
                  Um presente especial
                </p>

                <h2
                  id={titleId}
                  className="font-serif text-2xl leading-tight text-[#302b28] sm:text-3xl"
                >
                  {hasShares
                    ? 'Completar o presente'
                    : 'Presentear por completo'}
                </h2>

                <p className="mt-2 break-words text-sm leading-relaxed text-[#827573]">
                  {gift.title}
                </p>
              </div>
            </div>

            {hasShares && (
              <div className="mt-4 rounded-2xl border border-[#efdddf] bg-[#fff5f6] px-4 py-3.5 text-sm leading-relaxed text-[#6d5b58]">
                <p>
                  Este presente já tem cotas (
                  {formatBRL(gift.reservedAmount)} de {formatBRL(gift.price)}).
                </p>
                <p className="mt-1">
                  Faltam{' '}
                  <strong className="text-[#a9626b]">
                    {formatBRL(gift.availableAmount)}
                  </strong>.
                </p>
              </div>
            )}

            {errorBox}

            <p className="mb-3 mt-6 text-sm font-semibold text-[#514340]">
              Como você quer presentear?
            </p>

            <div className="space-y-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => claim('pix')}
                className={optionClass}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0f2] text-[#b47b7f] transition group-hover:bg-[#fbe5e8]">
                  <CreditCard size={19} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[#302b28]">
                    {loading
                      ? 'Reservando...'
                      : hasShares
                        ? 'Pagar o que falta por Pix'
                        : 'Pagar tudo por Pix'}
                  </span>

                  <span className="mt-1 block text-sm leading-relaxed text-[#827573]">
                    Você paga {formatBRL(gift.availableAmount)} agora, com QR
                    Code. A reserva vale 48h.
                  </span>
                </span>
              </button>

              {gift.productUrl && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError(null);
                    setStep('link');
                  }}
                  className={optionClass}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8f0e9] text-[#a77c66] transition group-hover:bg-[#f4e5d9]">
                    <ShoppingBag size={19} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#302b28]">
                      Comprar pelo link da loja
                    </span>

                    <span className="mt-1 block text-sm leading-relaxed text-[#827573]">
                      Você compra o presente na loja e volta aqui para avisar.
                    </span>
                  </span>

                  <ExternalLink
                    size={15}
                    className="mt-1 shrink-0 text-[#b47b7f] transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={closeDialog}
              className="mt-5 min-h-11 w-full rounded-xl border border-[#ead6d8] bg-white px-5 py-3 text-sm font-semibold text-[#786562] transition hover:border-[#d9aeb4] hover:bg-[#fff8f8] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/15"
            >
              Cancelar
            </button>
          </div>
        )}

        {step === 'payment' && pixResult && (
          <PixPaymentView
            titleId={titleId}
            giftTitle={gift.title}
            amount={pixResult.contribution.amount}
            expiresAt={pixResult.contribution.expiresAt}
            pixKey={pixResult.payment.pixKey}
            pixPayload={pixResult.payment.pixPayload}
            onClose={closeDialog}
          />
        )}

        {step === 'link' && gift.productUrl && (
          <div className="relative overflow-hidden p-5 sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-[#f4dfe1]/60 blur-3xl"
            />

            <div className="relative flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f8f0e9] text-[#a77c66] ring-1 ring-[#efe0d6]">
                <ShoppingBag size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a96f75]">
                  Compra na loja
                </p>

                <h2
                  id={titleId}
                  className="font-serif text-2xl leading-tight text-[#302b28] sm:text-3xl"
                >
                  Comprar pelo link da loja
                </h2>

                <p className="mt-2 break-words text-sm leading-relaxed text-[#827573]">
                  {gift.title}
                </p>
              </div>
            </div>

            <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#6d5b58]">
              <li>Abra a loja e finalize a compra.</li>
              <li>
                Volte aqui e toque em “Já comprei” para avisar os anfitriões.
              </li>
            </ol>

            <a
              href={gift.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c4777d] bg-white px-5 py-3 text-sm font-semibold text-[#9d646a] shadow-sm transition hover:bg-[#fff0f1] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/15"
            >
              Abrir a loja
              <ExternalLink size={15} />
            </a>

            {hasShares && (
              <p className="mt-4 rounded-2xl border border-[#f0dfe2] bg-[#fff1f3] px-4 py-3 text-xs leading-relaxed text-[#6d5b58]">
                Este presente já recebeu cotas de outros convidados; os
                anfitriões cuidam de acertar o valor delas.
              </p>
            )}

            <p className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              Só toque em “Já comprei” <strong>depois</strong> de finalizar a
              compra: ao marcar, o presente sai da lista para os outros
              convidados.
            </p>

            {errorBox}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setError(null);
                  setStep('choose');
                }}
                className="min-h-11 rounded-xl border border-[#e8caca] px-5 py-3 text-sm font-semibold text-[#6d5b58] transition hover:bg-[#fff8fb] disabled:opacity-60"
              >
                Voltar
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => claim('link')}
                className="min-h-11 rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Marcando...' : 'Já comprei'}
              </button>
            </div>
          </div>
        )}

        {step === 'link-done' && linkResult && (
          <div className="relative overflow-hidden p-5 text-center sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-[#f4dfe1]/60 blur-3xl"
            />

            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf7ef] text-[#568665] ring-1 ring-[#d9ebdd]">
              <CheckCircle2 size={27} />
            </div>

            <h2
              id={titleId}
              className="relative mt-4 font-serif text-2xl leading-tight text-[#302b28] sm:text-3xl"
            >
              Obrigado! 🎁
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-[#6d5b58]">
              Marcamos “{linkResult.gift.title}” como comprado. Os anfitriões
              foram avisados e o presente saiu da lista dos outros convidados.
            </p>

            <button
              type="button"
              onClick={closeDialog}
              className="mt-6 min-h-11 w-full rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/20"
            >
              Concluir
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
