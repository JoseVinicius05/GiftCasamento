'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Check, ExternalLink, Gift, Heart, Sparkles, CircleDollarSign, BanknoteArrowUp} from 'lucide-react';
import { firstApiMessage, formatBRL, parsePriceInput } from '../../lib/gifts';
import type { ContributionResult, GuestGift } from '../../lib/guest';
import PixPaymentView from './PixPaymentView';

// Botão de contribuição + modal. Mantém o fluxo original de reserva e pagamento.
const QUICK_AMOUNTS = [10, 25, 50];
const toInputText = (value: number) => String(value).replace('.', ',');

export default function GiftContribute({ slug, gift }: { slug: string; gift: GuestGift }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [step, setStep] = useState<'amount' | 'payment'>('amount');
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContributionResult | null>(null);

  const quickValues = QUICK_AMOUNTS.filter(
    (value) => value >= gift.minContribution && value < gift.availableAmount,
  );

  function openDialog() {
    setStep('amount');
    setAmountText('');
    setError(null);
    setResult(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleClosed() {
    if (result) router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const amount = parsePriceInput(amountText);
    if (amount === null) {
      setError('Informe um valor válido, por exemplo 50 ou 49,90.');
      return;
    }

    const cents = Math.round(amount * 100);
    if (cents < Math.round(gift.minContribution * 100)) {
      setError(
        gift.minContribution < 10
          ? `Para completar este presente, o valor é ${formatBRL(gift.minContribution)}.`
          : `O valor mínimo da cota é ${formatBRL(gift.minContribution)}.`,
      );
      return;
    }
    if (cents > Math.round(gift.availableAmount * 100)) {
      setError(`O valor máximo agora é ${formatBRL(gift.availableAmount)}.`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(slug)}/gifts/${encodeURIComponent(gift.id)}/contributions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (response.status === 201) {
        setResult(data as ContributionResult);
        setStep('payment');
        return;
      }
      if (response.status === 401) {
        closeDialog();
        router.refresh();
        return;
      }
      if (response.status === 409) {
        setError(firstApiMessage(data, 'Este presente mudou. Atualizamos os valores.'));
        router.refresh();
        return;
      }
      if (response.status === 429) {
        setError('Muitas tentativas seguidas. Aguarde um minuto e tente de novo.');
        return;
      }
      setError(firstApiMessage(data, 'Não foi possível reservar agora. Tente novamente em instantes.'));
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c4777d]/70 bg-white px-4 py-3 text-sm font-semibold text-[#9d646a] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#b66b72] hover:bg-[#fff4f5] hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b47b7f]/25 active:translate-y-0"
      >
        <BanknoteArrowUp size={16} className="transition-transform group-hover:scale-110" />
        Contribuir com uma cota
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClosed}
        aria-labelledby={`contribute-title-${gift.id}`}
        className="m-auto max-h-[min(92dvh,760px)] w-[calc(100%-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-[28px] border border-[#f0dfe2] bg-[#fffdfd] p-0 text-[#302b28] shadow-[0_24px_80px_rgba(80,48,52,0.24)] backdrop:bg-[#302b28]/45 backdrop:backdrop-blur-sm sm:w-[calc(100%-2rem)]"
      >
        {step === 'amount' && (
          <form onSubmit={handleSubmit} className="relative overflow-hidden p-5 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#f3dfe4]/70 blur-2xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-12 h-36 w-36 rounded-full bg-[#fff0f2] blur-2xl" />

            <div className="relative">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#b47b7f] ring-1 ring-[#f0dfe2]">
                  <CircleDollarSign size={23} strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b47b7f] sm:text-xs">Um gesto especial</p>
                  <h2 id={`contribute-title-${gift.id}`} className="mt-1 font-serif text-2xl leading-tight text-[#302b28] sm:text-3xl">
                    Contribuir com uma cota
                  </h2>
                  <p className="mt-1 break-words text-sm leading-relaxed text-[#827573]">{gift.title}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#f0dfe2] bg-gradient-to-br from-[#fff4f5] to-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#6d5b58]">Valor que falta</span>
                  <span className="text-lg font-bold tabular-nums text-[#b46f76] sm:text-xl">{formatBRL(gift.availableAmount)}</span>
                </div>
                <div className="my-3 h-1.5 overflow-hidden rounded-full bg-[#f0dfe2]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#d8a0a5] to-[#b66b72]"
                    style={{ width: `${Math.max(0, Math.min(100, ((gift.price - gift.availableAmount) / gift.price) * 100))}%` }}
                  />
                </div>
                <p className="text-xs leading-relaxed text-[#827573]">
                  De um total de {formatBRL(gift.price)}.{' '}
                  {gift.minContribution < 10 ? (
                    <>Para completar o presente, o valor mínimo é <strong className="text-[#6d5b58]">{formatBRL(gift.minContribution)}</strong>.</>
                  ) : (
                    <>Cota mínima: <strong className="text-[#6d5b58]">{formatBRL(gift.minContribution)}</strong>.</>
                  )}
                </p>
              </div>

              {error && (
                <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
                  <span className="font-bold" aria-hidden="true">!</span>
                  <span>{error}</span>
                </div>
              )}

              <label htmlFor={`amount-${gift.id}`} className="mb-2 mt-5 block text-sm font-semibold text-[#514340]">
                Quanto você quer contribuir?
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium text-[#9d8584]">R$</span>
                <input
                  id={`amount-${gift.id}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-[#e8caca] bg-white py-3.5 pl-12 pr-4 text-lg font-semibold text-[#302b28] outline-none transition placeholder:font-normal placeholder:text-[#c5b5b3] focus:border-[#c4777d] focus:ring-4 focus:ring-[#c4777d]/15 sm:py-4"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2" aria-label="Valores sugeridos">
                {quickValues.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmountText(toInputText(value))}
                    className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c4777d]/20 ${amountText === toInputText(value) ? 'border-[#c4777d] bg-[#c4777d] text-white shadow-sm' : 'border-[#e8caca] bg-white text-[#9d646a] hover:border-[#c4777d] hover:bg-[#fff0f1]'}`}
                  >
                    {formatBRL(value)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmountText(toInputText(gift.availableAmount))}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c4777d]/20 ${amountText === toInputText(gift.availableAmount) ? 'border-[#b66b72] bg-[#b66b72] text-white' : 'border-[#c4777d] bg-[#fff0f1] text-[#9d646a] hover:bg-[#fbe3e5]'}`}
                >
                  <Check size={14} /> Completar ({formatBRL(gift.availableAmount)})
                </button>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="min-h-11 w-full rounded-xl border border-[#e8caca] bg-white px-5 py-3 text-sm font-semibold text-[#6d5b58] transition hover:bg-[#fff8fb] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c4777d]/15 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#c4777d] to-[#b66b72] px-5 py-3 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(180,100,110,0.22)] transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c4777d]/25 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Sparkles size={16} />
                  {loading ? 'Reservando...' : 'Reservar e pagar com Pix'}
                </button>
              </div>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-[#a18d8b]">
                Sua reserva fica disponível por até 48 horas enquanto o pagamento é confirmado.
              </p>
            </div>
          </form>
        )}

        {step === 'payment' && result && (
          <PixPaymentView
            titleId={`contribute-title-${gift.id}`}
            giftTitle={gift.title}
            amount={result.contribution.amount}
            expiresAt={result.contribution.expiresAt}
            pixKey={result.payment.pixKey}
            pixPayload={result.payment.pixPayload}
            onClose={closeDialog}
          />
        )}
      </dialog>
    </>
  );
}
