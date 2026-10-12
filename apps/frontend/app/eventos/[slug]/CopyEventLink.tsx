'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Mostra o link REAL que o dono deve compartilhar (<site>/<slug>) e deixa
// copiar com um clique. Antes o painel mostrava "webgift.com/evento/<slug>",
// um endereço que não existe.
export default function CopyEventLink({ slug }: { slug: string }) {
  // Começa só com o caminho (igual no servidor e no navegador, sem erro de
  // hidratação) e ganha o domínio depois que a página carrega no navegador.
  const [link, setLink] = useState(`/${slug}`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}/${slug}`);
  }, [slug]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: o link continua visível
      // na tela pra copiar à mão.
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 break-all text-sm leading-relaxed text-[#514340]">{link}</p>

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#e8caca] bg-white px-3 py-1.5 text-xs font-semibold text-[#9d646a] transition hover:bg-[#fff0f1] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </div>
  );
}
