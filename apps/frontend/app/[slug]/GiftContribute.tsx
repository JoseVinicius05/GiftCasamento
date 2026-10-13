'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { firstApiMessage, formatBRL, parsePriceInput } from '../../lib/gifts';
import type { ContributionResult, GuestGift } from '../../lib/guest';

// Botão "Contribuir com uma cota" + modal. Dois passos:
//   1) valor da cota (mínimo R$ 10 ou o restante, máximo = o que falta)
//   2) dados de pagamento Pix (QR, Copia e Cola e chave) — a reserva já existe
//      e vale 48h; o dono confirma o recebimento manualmente depois.

const QUICK_AMOUNTS = [10, 25, 50];

const toInputText = (value: number) => String(value).replace('.', ',');

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão da área de transferência: o texto continua na tela
      // pra copiar à mão.
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#827573]">{label}</p>
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            readOnly
            value={value}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 resize-none rounded-lg border border-[#e8caca] bg-[#fffafa] px-3 py-2 text-xs text-[#514340] outline-none"
          />
        ) : (
          <p className="min-w-0 flex-1 break-all rounded-lg border border-[#e8caca] bg-[#fffafa] px-3 py-2 text-sm text-[#514340]">
            {value}
          </p>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e8caca] bg-white px-3 py-2 text-xs font-semibold text-[#9d646a] transition hover:bg-[#fff0f1] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

// QR do Pix Copia e Cola. A biblioteca é carregada só quando a tela de
// pagamento aparece (import dinâmico), pra não pesar a página de todo mundo.
function PixQrCode({ payload }: { payload: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { toDataURL } = await import('qrcode');
        const url = await toDataURL(payload, { margin: 1, width: 260, errorCorrectionLevel: 'M' });
        if (!cancelled) setSrc(url);
      } catch {
        // Sem QR não é grave: o Copia e Cola logo abaixo faz o mesmo papel.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (failed) return null;

  return (
    <div className="mx-auto flex h-[260px] w-[260px] items-center justify-center rounded-2xl border border-[#f0dfe2] bg-white p-2">
      {src ? (
        // <img> comum: é um data URL gerado agora, não há o que otimizar.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR Code Pix para pagar a cota" width={244} height={244} />
      ) : (
        <p className="text-xs text-[#827573]">Gerando QR Code...</p>
      )}
    </div>
  );
}

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

  const expiresAtText = result
    ? new Date(result.contribution.expiresAt).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '';

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c4777d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20"
      >
        Contribuir com uma cota
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClosed}
        // Durante o pagamento, Esc não fecha de primeira: os dados de Pix só
        // aparecem agora (a tela "Minhas contribuições" chega no Dia 4).
        onCancel={(event) => {
          if (step === 'payment') event.preventDefault();
        }}
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
          <div className="p-6 sm:p-8">
            <h2 id={`contribute-title-${gift.id}`} className="font-serif text-2xl">
              Cota reservada! 🎉
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6d5b58]">
              Reservamos <strong>{formatBRL(result.contribution.amount)}</strong> de “{gift.title}” para
              você até <strong>{expiresAtText}</strong>. Pague agora pelo Pix:
            </p>

            <div className="mt-5 space-y-4">
              {result.payment.pixPayload ? (
                <>
                  <PixQrCode payload={result.payment.pixPayload} />
                  <p className="text-center text-xs text-[#827573]">
                    No app do seu banco: Pix → Pagar → Ler QR Code
                  </p>
                  <CopyField label="Pix Copia e Cola" value={result.payment.pixPayload} multiline />
                </>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Não conseguimos gerar o QR Code. Pague pela chave abaixo, no valor de{' '}
                  <strong>{formatBRL(result.contribution.amount)}</strong>.
                </div>
              )}

              <CopyField label="Chave Pix" value={result.payment.pixKey} />
            </div>

            <div className="mt-5 space-y-2 rounded-xl bg-[#fff5f6] px-4 py-3 text-xs leading-relaxed text-[#6d5b58]">
              <p>
                Os anfitriões confirmam o recebimento manualmente. Se o pagamento não for confirmado
                até o prazo, a reserva é liberada e o valor volta a ficar disponível.
              </p>
              <p className="font-semibold">
                Guarde estes dados ou tire um print — por enquanto eles aparecem só agora.
              </p>
            </div>

            <button
              type="button"
              onClick={closeDialog}
              className="mt-6 min-h-11 w-full rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72]"
            >
              Concluir
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
