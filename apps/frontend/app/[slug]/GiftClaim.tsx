'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { firstApiMessage, formatBRL } from '../../lib/gifts';
import type { ClaimLinkResult, ClaimPixResult, GuestGift } from '../../lib/guest';
import PixPaymentView from './PixPaymentView';

// Botão "Presentear por completo" + modal. O convidado leva o presente todo
// (ou o que falta dele) de um de dois jeitos:
//   • Pix: reserva o valor restante por 48h e mostra QR/Copia e Cola
//     (a mesma tela de pagamento da cota);
//   • Link: compra na loja e volta aqui para marcar "comprei" — isso fecha
//     o presente para os outros convidados.

type Step = 'choose' | 'payment' | 'link' | 'link-done';

export default function GiftClaim({ slug, gift }: { slug: string; gift: GuestGift }) {
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

  // Disparado ao fechar (botão, Esc): se algo foi reservado/comprado, recarrega
  // a lista pra o card refletir o novo estado.
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
        // Sessão vencida: fecha e deixa a página mostrar a tela de entrada.
        closeDialog();
        router.refresh();
        return;
      }

      if (response.status === 409) {
        // Outra pessoa garantiu o presente no meio tempo: mostra o motivo e
        // atualiza a lista (o card some/muda atrás do modal).
        setError(firstApiMessage(data, 'Este presente mudou. Atualizamos a lista.'));
        router.refresh();
        return;
      }

      if (response.status === 429) {
        setError('Muitas tentativas seguidas. Aguarde um minuto e tente de novo.');
        return;
      }

      setError(firstApiMessage(data, 'Não foi possível concluir agora. Tente novamente em instantes.'));
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  const errorBox = error && (
    <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
      {error}
    </div>
  );

  const optionClass =
    'w-full rounded-2xl border border-[#e8caca] bg-white p-4 text-left transition hover:border-[#c4777d] hover:bg-[#fff8fb] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/15 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c4777d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20"
      >
        {hasShares ? 'Completar o presente' : 'Presentear por completo'}
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClosed}
        aria-labelledby={titleId}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-0 text-[#302b28] shadow-2xl backdrop:bg-black/40"
      >
        {step === 'choose' && (
          <div className="p-6 sm:p-8">
            <h2 id={titleId} className="font-serif text-2xl">
              {hasShares ? 'Completar o presente' : 'Presentear por completo'}
            </h2>
            <p className="mt-1 break-words text-sm text-[#827573]">{gift.title}</p>

            {hasShares && (
              <p className="mt-4 rounded-xl bg-[#fff5f6] px-4 py-3 text-sm text-[#6d5b58]">
                Este presente já tem cotas ({formatBRL(gift.reservedAmount)} de {formatBRL(gift.price)}).
                Faltam <strong>{formatBRL(gift.availableAmount)}</strong>.
              </p>
            )}

            {errorBox}

            <p className="mb-3 mt-5 text-sm font-medium text-[#514340]">Como você quer presentear?</p>

            <div className="space-y-3">
              <button type="button" disabled={loading} onClick={() => claim('pix')} className={optionClass}>
                <span className="block font-semibold text-[#302b28]">
                  {loading ? 'Reservando...' : hasShares ? 'Pagar o que falta por Pix' : 'Pagar tudo por Pix'}
                </span>
                <span className="mt-1 block text-sm text-[#827573]">
                  Você paga {formatBRL(gift.availableAmount)} agora, com QR Code. A reserva vale 48h.
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
                  <span className="block font-semibold text-[#302b28]">Comprar pelo link da loja</span>
                  <span className="mt-1 block text-sm text-[#827573]">
                    Você compra o presente na loja e volta aqui para avisar.
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={closeDialog}
              className="mt-5 min-h-11 w-full rounded-xl border border-[#e8caca] px-5 py-3 text-sm font-semibold text-[#6d5b58] transition hover:bg-[#fff8fb]"
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
          <div className="p-6 sm:p-8">
            <h2 id={titleId} className="font-serif text-2xl">
              Comprar pelo link da loja
            </h2>
            <p className="mt-1 break-words text-sm text-[#827573]">{gift.title}</p>

            <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#6d5b58]">
              <li>Abra a loja e finalize a compra.</li>
              <li>Volte aqui e toque em “Já comprei” para avisar os anfitriões.</li>
            </ol>

            <a
              href={gift.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c4777d] bg-white px-5 py-3 text-sm font-semibold text-[#9d646a] transition hover:bg-[#fff0f1]"
            >
              Abrir a loja
              <ExternalLink size={15} />
            </a>

            {hasShares && (
              <p className="mt-4 rounded-xl bg-[#fff5f6] px-4 py-3 text-xs leading-relaxed text-[#6d5b58]">
                Este presente já recebeu cotas de outros convidados; os anfitriões cuidam de acertar
                o valor delas.
              </p>
            )}

            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
              Só toque em “Já comprei” <strong>depois</strong> de finalizar a compra: ao marcar, o
              presente sai da lista para os outros convidados.
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
                className="min-h-11 rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Marcando...' : 'Já comprei'}
              </button>
            </div>
          </div>
        )}

        {step === 'link-done' && linkResult && (
          <div className="p-6 text-center sm:p-8">
            <h2 id={titleId} className="font-serif text-2xl">
              Obrigado! 🎁
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#6d5b58]">
              Marcamos “{linkResult.gift.title}” como comprado. Os anfitriões foram avisados e o
              presente saiu da lista dos outros convidados.
            </p>
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
