'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Gift } from 'lucide-react';
import { firstApiMessage } from '../../lib/gifts';

// Porta de entrada do convidado: senha do evento (que os anfitriões
// compartilharam) + o nome dele. Não existe conta — o nome é só pra os
// anfitriões saberem quem presenteou.
export default function GuestGate({ slug, expired = false }: { slug: string; expired?: boolean }) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/events/${encodeURIComponent(slug)}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          setError('Senha incorreta. Confira com os anfitriões.');
        } else if (response.status === 404) {
          setError('Evento não encontrado. Confira se o link está completo.');
        } else if (response.status === 429) {
          setError('Muitas tentativas seguidas. Aguarde um minuto e tente de novo.');
        } else if (response.status === 400) {
          setError(firstApiMessage(data, 'Confira os dados informados.'));
        } else {
          setError('Não foi possível entrar agora. Tente novamente em instantes.');
        }
        return;
      }

      // O cookie da sessão já foi gravado: recarrega a página (Server
      // Component), que agora enxerga o cookie e mostra a lista real.
      router.refresh();
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[#e8caca] bg-white px-4 py-3 text-[#302b28] outline-none transition placeholder:text-[#b9a9a7] focus:border-[#c4777d] focus:ring-4 focus:ring-[#c4777d]/15';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#fff8fb] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[#f0dfe2] bg-white/90 p-6 shadow-[0_16px_45px_rgba(115,77,77,0.08)] sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f1] text-[#b47b7f]">
          <Gift size={27} strokeWidth={1.6} />
        </div>

        <h1 className="mt-5 text-center font-serif text-3xl text-[#302b28]">
          Web<span className="italic text-[#b47b7f]">Gift</span>
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-[#827573]">
          Você foi convidado! Informe seu nome e a senha do evento para ver a lista de presentes.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {expired && !error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Sua sessão expirou. Entre de novo para continuar.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="guest-name" className="mb-2 block text-sm font-medium text-[#514340]">
              Seu nome
            </label>
            <input
              id="guest-name"
              type="text"
              autoComplete="name"
              placeholder="Como os anfitriões te conhecem"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="guest-password" className="mb-2 block text-sm font-medium text-[#514340]">
              Senha do evento
            </label>
            <input
              id="guest-password"
              type="password"
              autoComplete="off"
              placeholder="A senha que você recebeu"
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Ver lista de presentes'}
          </button>
        </form>
      </div>
    </main>
  );
}
