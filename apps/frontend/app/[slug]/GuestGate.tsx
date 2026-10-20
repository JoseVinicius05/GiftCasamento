
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Gift,
  Heart,
  LockKeyhole,
  UserRound,
  ArrowRight,
  LoaderCircle,
  ShieldCheck,
  EyeOff,
  Eye,
} from 'lucide-react';

import { firstApiMessage } from '../../lib/gifts';

export default function GuestGate({
  slug,
  expired = false,
}: {
  slug: string;
  expired?: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(slug)}/access`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            password,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          setError('Senha incorreta. Confira com os anfitriões.');
        } else if (response.status === 404) {
          setError('Evento não encontrado. Confira se o link está completo.');
        } else if (response.status === 429) {
          setError('Muitas tentativas. Aguarde um minuto e tente novamente.');
        } else if (response.status === 400) {
          setError(firstApiMessage(data, 'Confira os dados informados.'));
        } else {
          setError('Não foi possível entrar agora. Tente novamente em instantes.');
        }

        return;
      }

      router.refresh();
    } catch {
      setError('Não foi possível conectar ao servidor. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full min-w-0 rounded-2xl border border-[#ead9dc] bg-white/80 py-3.5 pl-11 pr-4 text-base text-[#302b28] outline-none transition duration-200 placeholder:text-[#b5a4a4] focus:border-[#c4777d] focus:bg-white focus:ring-4 focus:ring-[#c4777d]/10 disabled:opacity-60 sm:text-sm';

  return (
    // <main className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-x-clip bg-[#fff8fb] px-4 py-8 sm:px-6 sm:py-12">

    <main
      className={`
    relative flex h-dvh w-full items-center justify-center
    overflow-hidden px-4
    max-sm:h-auto max-sm:min-h-dvh
    max-sm:overflow-x-hidden max-sm:overflow-y-auto
    max-sm:items-start max-sm:py-6
  `}
    >


      {/* Fundo decorativo */}
      <div
        className="absolute inset-0 bg-[#fff7f8] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/background.png')",
        }}
      >
        <div className="absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[#f2d9df]/60 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-[#ead6d6]/60 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
      </div>

      {/* Conteúdo principal */}
      <div className="w-full max-w-[440px]">
        {/* Marca */}
        <div className="mb-6 flex items-center justify-center sm:mb-8">
          <a
            href="/"
            aria-label="WebGift - Página inicial"
            className="inline-flex items-center gap-2 rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#c4777d]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-[#b47b7f] shadow-sm ring-1 ring-[#efdde1]">
              <Gift size={20} strokeWidth={1.7} />
            </span>

            <span className="font-serif text-2xl tracking-tight text-[#302b28]">
              Web<span className="italic text-[#b47b7f]">Gift</span>
            </span>
          </a>
        </div>

        {/* Cartão */}
        <section className="overflow-hidden rounded-[28px] border border-white/90 bg-white/75 shadow-[0_24px_80px_rgba(115,77,77,0.12)] ring-1 ring-[#ead9dc]/60 backdrop-blur-xl sm:rounded-[32px]">
          <div className="px-5 pb-7 pt-7 sm:px-9 sm:pb-9 sm:pt-9">
            {/* Ícone principal */}
            <div className="relative mx-auto mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[26px] border border-[#f0dce0] bg-gradient-to-br from-[#fff1f4] to-[#f9e5e9] text-[#b47b7f] shadow-[0_8px_24px_rgba(180,123,127,0.10)] sm:h-[84px] sm:w-[84px] sm:rounded-[28px]">
              <Gift size={34} strokeWidth={1.45} />

              <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white text-[#c4777d] shadow-sm">
                <Heart size={13} fill="currentColor" strokeWidth={1.5} />
              </span>
            </div>

            <div className="text-center">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#b47b7f] sm:text-[11px]">
                Um momento especial
              </p>

              <h1 className="font-serif text-[28px] leading-tight tracking-tight text-[#302b28] sm:text-4xl">
                Você foi convidado!
              </h1>

              <p className="mx-auto mt-3 max-w-[310px] text-sm leading-6 text-[#827573] sm:text-[15px]">
                Entre para descobrir a lista de presentes e fazer parte desse
                momento tão especial.
              </p>
            </div>

            {/* Aviso de sessão expirada */}
            {expired && (
              <div className="mt-6 flex gap-3 rounded-2xl border border-[#ead9b8] bg-[#fffaf0] p-3.5 text-sm leading-5 text-[#8a6836]">
                <LockKeyhole size={18} className="mt-0.5 shrink-0" />
                <p>
                  Sua sessão expirou. Informe seus dados novamente para
                  continuar.
                </p>
              </div>
            )}

            {/* Erro */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-5 flex gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 p-3.5 text-sm leading-5 text-red-700"
              >
                <span className="mt-0.5 shrink-0">!</span>
                <p>{error}</p>
              </div>
            )}

            {/* Formulário */}
            <form className="mt-7 space-y-5 sm:mt-8" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="guest-name"
                  className="mb-2 block text-[13px] font-semibold text-[#514340]"
                >
                  Como podemos te chamar?
                </label>

                <div className="relative">
                  <UserRound
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.7}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#b49a9b]"
                  />

                  <input
                    id="guest-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Digite seu nome"
                    maxLength={60}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    className={inputClass}
                  />
                </div>

                <p className="mt-2 pl-1 text-xs leading-5 text-[#a08f8d]">
                  Assim, os anfitriões saberão quem está presenteando.
                </p>
              </div>

              <div>
                <label
                  htmlFor="guest-password"
                  className="mb-2 block text-[13px] font-semibold text-[#514340]"
                >
                  Senha do evento
                </label>

                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    size={18}
                    strokeWidth={1.7}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#b49a9b]"
                  />

                  <input
                    id="guest-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="off"
                    placeholder="Digite a senha recebida"
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#b47b7f]"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >{showPassword ? (<EyeOff className="h-5 w-5" />) : (<Eye className="h-5 w-5" />)}</button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !password}
                className="group inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#c4777d] to-[#b66b75] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(180,107,117,0.22)] transition duration-200 hover:-translate-y-0.5 hover:from-[#b66b75] hover:to-[#a95f69] hover:shadow-[0_12px_26px_rgba(180,107,117,0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c4777d]/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_8px_20px_rgba(180,107,117,0.22)]"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Verificando acesso...
                  </>
                ) : (
                  <>
                    Acessar lista de presentes
                    <ArrowRight
                      size={17}
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Privacidade */}
            <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#f1e5e7] pt-5 text-center text-xs leading-5 text-[#9b8988]">
              <ShieldCheck
                size={15}
                strokeWidth={1.7}
                className="shrink-0 text-[#b47b7f]"
              />
              <span>Seu acesso é protegido e seus dados são tratados com cuidado.</span>
            </div>
          </div>
        </section>

        <p className="mt-6 px-3 text-center text-xs leading-5 text-[#a18e90]">
          Feito com carinho para celebrar momentos inesquecíveis.
          <Heart
            aria-label="amor"
            size={12}
            fill="currentColor"
            className="ml-1 inline-block text-[#c4777d]"
          />
        </p>
      </div>
    </main>
  );
}
