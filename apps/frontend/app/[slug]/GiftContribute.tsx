'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { firstApiMessage, formatBRL, parsePriceInput } from '../../lib/gifts';
import type { ContributionResult, GuestGift } from '../../lib/guest';
import PixPaymentView from './PixPaymentView';

// Botão "Contribuir com uma cota" (secundário) + modal. Dois passos:
//   1) valor da cota (mínimo R$ 10 ou o restante, máximo = o que falta)
//   2) dados de pagamento Pix (QR, Copia e Cola e chave) — a reserva já existe
//      e vale 48h; o dono confirma o recebimento manualmente depois.

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

  // Atalhos: 10 / 25 / 50 que cabem, mais "o restante". Sem duplicar valores.
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

  // Disparado ao fechar (botão, Esc): se uma cota foi criada, recarrega a
  // lista pra barra de progresso refletir a reserva nova.
  function handleClosed() {
    if (result) router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
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
        // Sessão vencida: fecha e deixa a página mostrar a tela de entrada.
        closeDialog();
        router.refresh();
        return;
      }

      if (response.status === 409) {
        // Alguém reservou no meio tempo: mostra o motivo e atualiza a lista
        // pra o "valor disponível" do modal ficar correto.
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
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#c4777d] bg-white px-4 py-3 text-sm font-semibold text-[#9d646a] transition hover:bg-[#fff0f1] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20"
      >
        Contribuir com uma cota
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClosed}
        aria-labelledby={`contribute-title-${gift.id}`}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-0 text-[#302b28] shadow-2xl backdrop:bg-black/40"
      >
        {step === 'amount' && (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <h2 id={`contribute-title-${gift.id}`} className="font-serif text-2xl">
              Contribuir com uma cota
            </h2>
            <p className="mt-1 break-words text-sm text-[#827573]">{gift.title}</p>

            <div className="mt-4 rounded-xl bg-[#fff5f6] px-4 py-3 text-sm text-[#6d5b58]">
              Ainda faltam <strong>{formatBRL(gift.availableAmount)}</strong> de{' '}
              {formatBRL(gift.price)}.
              <br />
              {gift.minContribution < 10 ? (
                <>
                  Para completar, o valor é <strong>{formatBRL(gift.minContribution)}</strong>.
                </>
              ) : (
                <>
                  Cota mínima: <strong>{formatBRL(gift.minContribution)}</strong>.
                </>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {error}
              </div>
            )}

            <label htmlFor={`amount-${gift.id}`} className="mb-2 mt-5 block text-sm font-medium text-[#514340]">
              Quanto você quer contribuir?
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#827573]">R$</span>
              <input
                id={`amount-${gift.id}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                required
                className="w-full rounded-xl border border-[#e8caca] bg-white py-3 pl-11 pr-4 text-lg text-[#302b28] outline-none transition placeholder:text-[#b9a9a7] focus:border-[#c4777d] focus:ring-4 focus:ring-[#c4777d]/15"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickValues.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmountText(toInputText(value))}
                  className="rounded-full border border-[#e8caca] px-3 py-1.5 text-sm font-medium text-[#9d646a] transition hover:bg-[#fff0f1]"
                >
                  {formatBRL(value)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmountText(toInputText(gift.availableAmount))}
                className="rounded-full border border-[#c4777d] bg-[#fff0f1] px-3 py-1.5 text-sm font-semibold text-[#9d646a] transition hover:bg-[#fbe3e5]"
              >
                Completar ({formatBRL(gift.availableAmount)})
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                className="min-h-11 rounded-xl border border-[#e8caca] px-5 py-3 text-sm font-semibold text-[#6d5b58] transition hover:bg-[#fff8fb]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-11 rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Reservando...' : 'Reservar e pagar com Pix'}
              </button>
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
