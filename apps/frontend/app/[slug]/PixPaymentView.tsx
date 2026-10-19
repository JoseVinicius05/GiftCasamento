'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Heart, QrCode, ShieldCheck, Clock3 } from 'lucide-react';
import { formatBRL } from '../../lib/gifts';

// Tela de pagamento Pix (QR Code, Copia e Cola e chave), usada tanto na cota
// quanto no "pagar tudo por Pix" — nos dois casos o que existe é uma cota
// reservada por 48h esperando o pagamento.

function CopyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
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
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8d7776]">
        {label}
      </p>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
        {multiline ? (
          <textarea
            readOnly
            value={value}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={label}
            className="min-w-0 w-full flex-1 resize-y rounded-xl border border-[#ead6d8] bg-white px-3.5 py-3 text-xs leading-relaxed text-[#514340] outline-none transition focus:border-[#c4777d] focus:ring-4 focus:ring-[#c4777d]/10 sm:resize-none"
          />
        ) : (
          <p className="min-w-0 w-full flex-1 break-all rounded-xl border border-[#ead6d8] bg-white px-3.5 py-3 text-sm leading-relaxed text-[#514340]">
            {value}
          </p>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#e7c8cc] bg-[#fff8f8] px-4 py-2.5 text-xs font-bold text-[#9d646a] transition hover:border-[#d9aeb4] hover:bg-[#fff0f2] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/20 active:scale-[0.98] sm:w-auto"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
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
        const url = await toDataURL(payload, {
          margin: 1,
          width: 260,
          errorCorrectionLevel: 'M',
        });
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
    <div className="mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center rounded-2xl border border-[#f0dfe2] bg-white p-2 shadow-[0_8px_24px_rgba(107,73,76,0.06)]">
      {src ? (
        // <img> comum: é um data URL gerado agora, não há o que otimizar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="QR Code Pix para pagar"
          width={244}
          height={244}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1f2] text-[#b47b7f]">
            <QrCode size={21} />
          </div>
          <p className="text-xs font-medium text-[#827573]">Gerando QR Code...</p>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#f5e5e7]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#c4777d]" />
          </div>
        </div>
      )}
    </div>
  );
}

type PixPaymentViewProps = {
  titleId: string;
  giftTitle: string;
  amount: number;
  expiresAt: string;
  pixKey: string;
  pixPayload: string | null;
  onClose: () => void;
  // true quando o convidado reabre os dados de uma reserva que já existia
  // ("Minhas contribuições"): muda os textos, não o conteúdo de pagamento.
  reopened?: boolean;
};

export default function PixPaymentView({
  titleId,
  giftTitle,
  amount,
  expiresAt,
  pixKey,
  pixPayload,
  onClose,
  reopened = false,
}: PixPaymentViewProps) {
  const expiresAtText = new Date(expiresAt).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="relative w-full min-w-0 overflow-hidden bg-[#fffdfc]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#f4dfe1]/55 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-[#f8e9e5]/60 blur-3xl" />

      <div className="relative p-4 sm:p-6 md:p-8">
        <div className="mb-5 flex items-start gap-3 sm:mb-6 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#b47b7f] ring-1 ring-[#f1d9dc] sm:h-12 sm:w-12">
            {reopened ? <Heart size={21} /> : <Check size={22} strokeWidth={2.5} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-xl font-semibold leading-tight text-[#302b28] sm:text-2xl">
              {reopened ? 'Dados de pagamento' : 'Reserva feita!'}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#8b7371]">
              {reopened ? 'Consulte os dados para concluir seu Pix.' : 'Seu presente está reservado com carinho.'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#f0dfe1] bg-white/90 p-4 shadow-[0_6px_22px_rgba(107,73,76,0.045)] sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#987f7d]">
            Presente escolhido
          </p>
          <p className="mt-1.5 break-words font-serif text-lg font-semibold leading-snug text-[#302b28] sm:text-xl">
            {giftTitle}
          </p>
          <div className="mt-4 flex flex-col gap-3 border-t border-[#f2e6e6] pt-4 xs:flex-row xs:items-end xs:justify-between">
            <div>
              <p className="text-xs text-[#8b7371]">Valor reservado</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-[#a9626b] sm:text-3xl">
                {formatBRL(amount)}
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-[#fff5f5] px-3 py-2.5 text-[#8e666a]">
              <Clock3 size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider">Válida até</p>
                <p className="mt-0.5 text-xs font-semibold leading-relaxed">{expiresAtText}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-[#6d5b58]">
          {reopened ? (
            <>
              Sua reserva de <strong className="text-[#514340]">{formatBRL(amount)}</strong> de “{giftTitle}” vale até{' '}
              <strong className="text-[#514340]">{expiresAtText}</strong>. Pague pelo Pix:
            </>
          ) : (
            <>
              Reservamos <strong className="text-[#514340]">{formatBRL(amount)}</strong> de “{giftTitle}” para você até{' '}
              <strong className="text-[#514340]">{expiresAtText}</strong>. Pague agora pelo Pix:
            </>
          )}
        </p>

        <div className="mt-5 space-y-5 sm:mt-6">
          {pixPayload ? (
            <>
              <div className="rounded-2xl border border-[#f0e1e2] bg-[#fff8f8]/90 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-[#6d5555]">
                  <QrCode size={17} className="text-[#b47b7f]" />
                  Escaneie o QR Code com seu banco
                </div>
                <PixQrCode payload={pixPayload} />
                <p className="mt-3 text-center text-xs leading-relaxed text-[#8b7775]">
                  Abra o app do banco, escolha Pix e leia o código acima.
                </p>
              </div>
              <CopyField label="Pix Copia e Cola" value={pixPayload} multiline />
            </>
          ) : (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-relaxed text-amber-800">
              <ShieldCheck size={19} className="mt-0.5 shrink-0" />
              <p>
                Não conseguimos gerar o QR Code. Pague pela chave abaixo, no valor de{' '}
                <strong>{formatBRL(amount)}</strong>.
              </p>
            </div>
          )}

          <CopyField label="Chave Pix" value={pixKey} />
        </div>

        <div className="mt-5 space-y-2.5 rounded-2xl border border-[#f0e0e2] bg-[#fff5f6]/90 px-4 py-4 text-xs leading-relaxed text-[#755f5d] sm:mt-6 sm:px-5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#b47b7f]" />
            <p>
              Os anfitriões confirmam o recebimento manualmente. Se o pagamento não for confirmado
              até o prazo, a reserva é liberada e o valor volta a ficar disponível.
            </p>
          </div>
          {!reopened && (
            <p className="border-t border-[#eedcde] pt-2.5 font-semibold text-[#8b666a]">
              Se fechar esta tela, você pode reabrir estes dados em “Minhas contribuições”, enquanto
              a reserva estiver valendo.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full rounded-xl bg-[#c4777d] px-5 py-3.5 text-sm font-bold text-white shadow-[0_5px_14px_rgba(180,123,127,0.22)] transition hover:bg-[#b66b72] hover:shadow-[0_7px_18px_rgba(180,123,127,0.28)] focus:outline-none focus:ring-4 focus:ring-[#c4777d]/25 active:scale-[0.99] sm:mt-6"
        >
          {reopened ? 'Fechar' : 'Concluir'}
        </button>
      </div>
    </div>
  );
}
