import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TOKEN_COOKIE } from '../../../lib/auth-cookie';
import EditEventForm from './EditEventForm';
import AddGiftForm from './AddGiftForm';
import GiftList from './GiftList';
import CopyEventLink from './CopyEventLink';
import type { Gift as GiftType } from '../../../lib/gifts';
import {
  ArrowLeft,
  CalendarDays,
  Gift,
  Heart,
  Wallet,
  Cake,
  Baby,
  CookingPot,
  PartyPopper,
  Sparkles,
} from 'lucide-react';

type EventTypeValue =
  | 'casamento'
  | 'aniversario'
  | 'cha_de_bebe'
  | 'cha_de_cozinha'
  | 'outro';

const EVENT_TYPE_LABELS: Record<EventTypeValue, string> = {
  casamento: 'Casamento',
  aniversario: 'Aniversário',
  cha_de_bebe: 'Chá de bebê',
  cha_de_cozinha: 'Chá de cozinha',
  outro: 'Outro',
};

type Event = {
  id: string;
  title: string;
  eventType: EventTypeValue;
  eventDate: string;
  slug: string;
  pixKey: string;
};


function EventTypeIcon({ type }: { type: EventTypeValue }) {
  const iconClass = 'h-5 w-5 sm:h-6 sm:w-6';

  switch (type) {
    case 'casamento':
      return <Heart className={iconClass} />;

    case 'aniversario':
      return <Cake className={iconClass} />;

    case 'cha_de_bebe':
      return <Baby className={iconClass} />;

    case 'cha_de_cozinha':
      return <CookingPot className={iconClass} />;

    default:
      return <PartyPopper className={iconClass} />;
  }
}


function ErrorState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-dvh overflow-x-clip bg-[#fff8fb] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-[#f0dfe2] bg-white/90 p-6 text-center shadow-[0_16px_45px_rgba(115,77,77,0.08)] sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f1] text-[#b47b7f]">
          <Heart size={27} strokeWidth={1.6} />
        </div>

        <h1 className="mt-5 font-serif text-2xl text-[#302b28] sm:text-3xl">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-[#827573] sm:text-base">
          {message}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 sm:w-auto"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}

export default async function PainelEventoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    redirect(`/login?redirectTo=/eventos/${slug}`);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return (
      <ErrorState
        title="Configuração indisponível"
        message="Não foi possível conectar ao servidor. Tente novamente mais tarde."
      />
    );
  }

  let response: Response;

  try {
    response = await fetch(`${apiUrl}/events/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return (
      <ErrorState
        title="Não foi possível carregar o evento"
        message="Não conseguimos falar com o servidor agora. Tente novamente em instantes."
      />
    );
  }

  if (response.status === 401) {
    redirect(`/login?redirectTo=/eventos/${slug}`);
  }

  if (response.status === 404) {
    redirect('/meus-eventos');
  }

  if (!response.ok) {
    return (
      <ErrorState
        title="Algo deu errado"
        message="Não foi possível carregar os dados do evento. Tente novamente em instantes."
      />
    );
  }

  const event: Event = await response.json();
  const eventDateForInput = event.eventDate.slice(0, 10);

  let gifts: GiftType[] = [];
  let giftsLoadFailed = false;

  try {
    const giftsResponse = await fetch(`${apiUrl}/events/${slug}/gifts`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (giftsResponse.ok) {
      gifts = await giftsResponse.json();
    } else {
      giftsLoadFailed = true;
    }
  } catch {
    giftsLoadFailed = true;
  }

  const formattedDate = new Date(event.eventDate).toLocaleDateString(
    'pt-BR',
    {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  );

  return (
    <main className="relative min-h-dvh overflow-x-clip bg-[#fff8fb] px-3 py-5 sm:px-5 sm:py-8 lg:px-8 lg:py-10">
      {/* Decoração de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-[#e8caca]/25 blur-3xl sm:h-80 sm:w-80"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-[35rem] h-64 w-64 rounded-full bg-[#f3dfe4]/40 blur-3xl"
      />

      <div className="relative mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-5 sm:gap-6 lg:gap-7">
        {/* Cabeçalho do evento */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-[0_16px_45px_rgba(115,77,77,0.07)] backdrop-blur-xl sm:rounded-3xl">

          <div className="px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8 mb-5">
            <a
              href="/meus-eventos"
              className="group inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-[#e8caca]/70 bg-white/80 px-3 py-2 text-sm font-medium text-[#8e6568] shadow-sm transition-all duration-200 hover:border-[#c4777d]/50 hover:bg-[#fff0f1] hover:text-[#b47b7f] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 sm:px-4"
            >
              <ArrowLeft
                size={17}
                className="shrink-0 transition-transform duration-200 group-hover:-translate-x-1"
              />
            </a>
          </div>
          <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-8 md:pb-8">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e8caca]/60 bg-[#fff0f1] text-[#b47b7f] sm:h-14 sm:w-14">
                <Gift size={24} strokeWidth={1.6} className="sm:hidden" />
                <Gift
                  size={29}
                  strokeWidth={1.6}
                  className="hidden sm:block"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b47b7f] sm:text-sm">
                  Painel do evento
                </p>

                <h1 className="mt-2 max-w-full break-words font-serif text-3xl font-bold leading-[1.12] tracking-tight text-[#302b28] sm:text-4xl md:text-5xl lg:text-6xl">
                  {event.title}
                  <span
                    aria-hidden="true"
                    className="mt-3 block h-1 w-16 rounded-full bg-gradient-to-r from-[#b47b7f] to-[#e8caca] sm:mt-4 sm:w-20"
                  />
                </h1>

                <p className="mt-2 text-sm leading-relaxed text-[#827573]">
                  Organize seu evento e gerencie sua lista de presentes.
                </p>
              </div>
            </div>

            <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 border-t border-[#eee1df] pt-5 sm:grid-cols-2">
              <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[#f0e3e3] bg-[#fffaf9] p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0f1] text-[#b47b7f]">
                  <EventTypeIcon type={event.eventType} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#968986]">
                    Tipo de evento
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-[#514340]">
                    {EVENT_TYPE_LABELS[event.eventType] ?? 'Outro'}
                  </p>
                </div>
              </div>

              <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[#f0e3e3] bg-[#fffaf9] p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0f1] text-[#b47b7f]">
                  <CalendarDays size={18} />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#968986]">
                    Data do evento
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold capitalize text-[#514340]">
                    {formattedDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Link público do evento */}
            <div className="mt-4 min-w-0 rounded-xl border border-[#e8caca]/60 bg-[#fff5f6] p-3 sm:p-4">
              <p className="text-xs font-semibold text-[#9d646a] sm:text-sm">
                Link do seu evento
              </p>

              <CopyEventLink slug={event.slug} />
            </div>
          </div>
        </section>

        {/* Cadastro de presentes */}
        <section className="min-w-0">
          <AddGiftForm slug={event.slug} />
        </section>

        {/* Lista de presentes */}
        <section className="min-w-0">
          <GiftList
            slug={event.slug}
            gifts={gifts}
            loadFailed={giftsLoadFailed}
          />
        </section>

        {/* Configurações do evento */}
        <section className="min-w-0">
          <EditEventForm
            slug={event.slug}
            initialTitle={event.title}
            initialEventType={event.eventType}
            initialEventDate={eventDateForInput}
            initialPixKey={event.pixKey}
          />
        </section>

        {/* Rodapé */}
        <footer className="pb-3 pt-1 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-[#a18e8b] sm:text-sm">
            <Wallet size={15} />
            <span>Gerencie seus presentes com carinho usando o WebGift.</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
