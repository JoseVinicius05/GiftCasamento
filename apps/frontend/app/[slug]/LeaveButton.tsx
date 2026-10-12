'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// "Não é você?": apaga a sessão do convidado neste aparelho e volta pra
// tela de senha/nome (útil quando o celular é compartilhado).
export default function LeaveButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/events/${encodeURIComponent(slug)}/access`, { method: 'DELETE' });
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="font-medium text-[#b47b7f] underline underline-offset-2 transition hover:text-[#9d646a] disabled:opacity-60"
    >
      {loading ? 'Saindo...' : 'Não é você? Trocar nome'}
    </button>
  );
}
