import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Baby,
  Cake,
  CalendarDays,
  ChevronRight,
  Heart,
  Sparkles,
  Utensils,
} from "lucide-react";

import { TOKEN_COOKIE } from "../../lib/auth-cookie";

type EventTypeValue =
  | "casamento"
  | "aniversario"
  | "cha_de_bebe"
  | "cha_de_cozinha"
  | "outro";

const EVENT_TYPE_LABELS: Record<EventTypeValue, string> = {
  casamento: "Casamento",
  aniversario: "Aniversário",
  cha_de_bebe: "Chá de bebê",
  cha_de_cozinha: "Chá de cozinha",
  outro: "Outro",
};

const EVENT_TYPE_ICONS: Record<
  EventTypeValue,
  typeof Heart
> = {
  casamento: Heart,
  aniversario: Cake,
  cha_de_bebe: Baby,
  cha_de_cozinha: Utensils,
  outro: Sparkles,
};

type Event = {
  id: string;
  title: string;
  eventType: EventTypeValue;
  eventDate: string;
  slug: string;
};

// Server Component:
// lê o cookie, repassa o token para o backend
// e nunca expõe o JWT ao navegador.
export default async function MeusEventosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    redirect("/login?redirectTo=/meus-eventos");
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const response = await fetch(`${apiUrl}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/login?redirectTo=/meus-eventos");
  }

  const events: Event[] = await response.json();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-10">
      {/* =========================================================
          BACKGROUND
      ========================================================= */}

      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/background.png')",
        }}
      />

      {/* Overlay */}
      <div className="fixed inset-0 bg-[#fff7f8]/70" />

      {/* Blur */}
      <div className="fixed inset-0 backdrop-blur-[2px]" />

      {/* =========================================================
          DECORAÇÕES
      ========================================================= */}

      <div className="pointer-events-none fixed -left-32 -top-32 h-96 w-96 rounded-full bg-[#e8caca]/30 blur-3xl" />

      <div className="pointer-events-none fixed -bottom-40 -right-32 h-96 w-96 rounded-full bg-[#ead6d6]/40 blur-3xl" />

      <div className="pointer-events-none fixed left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3e2e1]/20 blur-3xl" />

      {/* =========================================================
          CONTEÚDO
      ========================================================= */}

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* =======================================================
            HEADER
        ======================================================= */}

        <header className="mb-12 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="font-serif text-3xl tracking-tight text-[#302b28] transition-opacity hover:opacity-80"
          >
            Web
            <span className="italic text-[#b47b7f]">Gift</span>
          </Link>

          {/* Novo evento */}
          <Link
            href="/criar-casamento"
            className="group inline-flex items-center gap-2 rounded-xl bg-[#c4777d] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#b66b72] hover:shadow-lg md:px-5 md:py-3"
          >
            <span className="text-lg leading-none">+</span>

            <span>Novo evento</span>
          </Link>
        </header>

        {/* =======================================================
            TÍTULO
        ======================================================= */}

        <section className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#b47b7f]">
            Seu espaço
          </p>

          <h1 className="font-serif text-4xl tracking-tight text-[#342f2b] md:text-5xl">
            Meus eventos
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500 md:text-base">
            Gerencie suas celebrações e listas de presentes em um só lugar.
          </p>
        </section>

        {/* =======================================================
            CONTADOR
        ======================================================= */}

        <div className="mb-8 inline-flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e2e1] text-[#b47b7f]">
            <Heart className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs text-gray-400">
              Seus eventos
            </p>

            <p className="font-semibold text-[#342f2b]">
              {events.length}{" "}
              {events.length === 1 ? "evento" : "eventos"}
            </p>
          </div>
        </div>

        {/* =======================================================
            ESTADO VAZIO
        ======================================================= */}

        {events.length === 0 ? (
          <div className="rounded-[30px] border border-white/70 bg-white/70 p-8 text-center shadow-xl backdrop-blur-xl md:p-14">
            {/* Ícone */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f3e2e1] text-[#b47b7f] shadow-sm">
              <Heart className="h-9 w-9" strokeWidth={1.7} />
            </div>

            {/* Título */}
            <h2 className="font-serif text-3xl tracking-tight text-[#342f2b]">
              Sua primeira celebração começa aqui
            </h2>

            {/* Descrição */}
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">
              Crie seu evento, monte sua lista de presentes e
              compartilhe tudo com seus convidados de forma
              simples e elegante.
            </p>

            {/* Botão */}
            <Link
              href="/criar-casamento"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#c4777d] px-6 py-3 font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#b66b72] hover:shadow-lg"
            >
              Criar meu primeiro evento

              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          /* =====================================================
             LISTA DE EVENTOS
          ===================================================== */

          <ul className="grid gap-5 md:grid-cols-2">
            {events.map((event) => {
              const Icon = EVENT_TYPE_ICONS[event.eventType];

              return (
                <li key={event.id}>
                  <Link
                    href={`/eventos/${event.slug}`}
                    className="group relative block h-full overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-6 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/85 hover:shadow-2xl md:p-7"
                  >
                    {/* Brilho decorativo */}
                    <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-[#f3e2e1]/50 blur-3xl transition-all duration-500 group-hover:bg-[#e8caca]/60" />

                    {/* Conteúdo */}
                    <div className="relative">
                      {/* Tipo + seta */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3e2e1] text-[#b47b7f] transition-all duration-300 group-hover:bg-[#c4777d] group-hover:text-white">
                            <Icon
                              className="h-5 w-5"
                              strokeWidth={1.8}
                            />
                          </div>

                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b47b7f]">
                              {EVENT_TYPE_LABELS[event.eventType]}
                            </p>

                            <p className="mt-0.5 text-xs text-gray-400">
                              Evento
                            </p>
                          </div>
                        </div>

                        {/* Seta */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f8eeee] text-[#b47b7f] transition-all duration-300 group-hover:bg-[#c4777d] group-hover:text-white">
                          <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </div>
                      </div>

                      {/* Título */}
                      <h2 className="mt-7 font-serif text-2xl tracking-tight text-[#342f2b] md:text-3xl">
                        {event.title}
                      </h2>

                      {/* Data */}
                      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                        <CalendarDays className="h-4 w-4 shrink-0 text-[#b47b7f]" />

                        <span>
                          {new Date(
                            event.eventDate
                          ).toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Separador */}
                      <div className="my-6 h-px bg-gray-200/70" />

                      {/* URL */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                            Página do evento
                          </p>

                          <p className="truncate text-xs text-gray-500">
                            giftcasamento.com/casamento/
                            {event.slug}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs font-semibold text-[#b47b7f] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                          Abrir
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* =======================================================
            RODAPÉ
        ======================================================= */}

        <footer className="mt-12 pb-6 text-center">
          <p className="text-xs text-gray-400">
            Feito para transformar momentos especiais em presentes.
          </p>

          <p className="mt-1 font-serif text-sm text-[#b47b7f]">
            Web<span className="italic">Gift</span>
          </p>
        </footer>
      </div>
    </main>
  );
}