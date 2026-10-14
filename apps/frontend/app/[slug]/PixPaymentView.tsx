'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatBRL } from '../../lib/gifts';

// Tela de pagamento Pix (QR Code, Copia e Cola e chave), usada tanto na cota
// quanto no "pagar tudo por Pix" — nos dois casos o que existe é uma cota
// reservada por 48h esperando o pagamento.

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
        <img src={src} alt="QR Code Pix para pagar" width={244} height={244} />
      ) : (
        <p className="text-xs text-[#827573]">Gerando QR Code...</p>
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
    <div className="p-6 sm:p-8">
      <h2 id={titleId} className="font-serif text-2xl">
        {reopened ? 'Dados de pagamento' : 'Reserva feita! 🎉'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6d5b58]">
        {reopened ? (
          <>
            Sua reserva de <strong>{formatBRL(amount)}</strong> de “{giftTitle}” vale até{' '}
            <strong>{expiresAtText}</strong>. Pague pelo Pix:
          </>
        ) : (
          <>
            Reservamos <strong>{formatBRL(amount)}</strong> de “{giftTitle}” para você até{' '}
            <strong>{expiresAtText}</strong>. Pague agora pelo Pix:
          </>
        )}
      </p>

      <div className="mt-5 space-y-4">
        {pixPayload ? (
          <>
            <PixQrCode payload={pixPayload} />
            <p className="text-center text-xs text-[#827573]">
              No app do seu banco: Pix → Pagar → Ler QR Code
            </p>
            <CopyField label="Pix Copia e Cola" value={pixPayload} multiline />
          </>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Não conseguimos gerar o QR Code. Pague pela chave abaixo, no valor de{' '}
            <strong>{formatBRL(amount)}</strong>.
          </div>
        )}

        <CopyField label="Chave Pix" value={pixKey} />
      </div>

      <div className="mt-5 space-y-2 rounded-xl bg-[#fff5f6] px-4 py-3 text-xs leading-relaxed text-[#6d5b58]">
        <p>
          Os anfitriões confirmam o recebimento manualmente. Se o pagamento não for confirmado
          até o prazo, a reserva é liberada e o valor volta a ficar disponível.
        </p>
        {!reopened && (
          <p className="font-semibold">
            Se fechar esta tela, você reabre estes dados em “Minhas contribuições”, enquanto a
            reserva estiver valendo.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 min-h-11 w-full rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72]"
      >
        {reopened ? 'Fechar' : 'Concluir'}
      </button>
    </div>
  );
}
