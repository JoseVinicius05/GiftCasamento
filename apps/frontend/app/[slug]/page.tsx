import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Gift as GiftIcon } from 'lucide-react';
import { formatBRL } from '../../lib/gifts';
import { guestCookieName } from '../../lib/guest-cookie';
import {
  GUEST_EVENT_KICKER,
  isGiftClosed,
  type GuestGift,
  type GuestOverview,
  type MyContribution,
} from '../../lib/guest';
import GiftClaim from './GiftClaim';
import GiftContribute from './GiftContribute';
import GuestGate from './GuestGate';
import LeaveButton from './LeaveButton';
import MyContributions from './MyContributions';

function MessageState({
  slug,
  title,
  message,
}: {
  slug: string;
  title: string;
  message: string;
}) {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-x-hidden bg-[#fff7f8] px-4 py-8 sm:py-10">
      <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-white/85 p-6 text-center shadow-[0_20px_60px_rgba(115,77,77,0.12)] backdrop-blur-xl sm:p-8">
        <h1 className="font-serif text-2xl text-[#302b28]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#827573]">{message}</p>
        <a
          href={`/${slug}`}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#b47b7f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#a5686e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b47b7f] focus-visible:ring-offset-2 sm:w-auto"
        >
          Tentar novamente
        </a>
      </div>
    </main>
  );
}

function GiftStatusArea({ gift }: { gift: GuestGift }) {
  if (isGiftClosed(gift.status) || gift.availableAmount <= 0) {
    const message =
      gift.status === 'purchased_via_link'
        ? 'Já comprado por outro convidado'
        : gift.status === 'confirmed'
          ? 'Presente já garantido'
          : 'Já reservado por outros convidados';

    return (
      <p className="mt-2 rounded-xl bg-[#f8f2f2] px-3 py-2.5 text-center text-xs font-medium text-[#827573]">
        {message}
      </p>
    );
  }

  const hasShares = gift.reservedAmount > 0;
  const percent = Math.min(
    100,
    Math.round((gift.reservedAmount / gift.price) * 100),
  );

  return (
    <div className="mt-2">
      {hasShares ? (
        <>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[#f3e4e6]"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Quanto do presente já foi garantido em cotas"
          >
            <div
              className="h-full rounded-full bg-[#c4777d] transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#827573]">
            {formatBRL(gift.reservedAmount)} já garantidos · faltam{' '}
            {formatBRL(gift.availableAmount)}
          </p>
        </>
      ) : (
        <p className="text-xs text-[#91807d]">
          Seja o primeiro a escolher este presente
        </p>
      )}
    </div>
  );
}

export default async function EventoConvidadoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(guestCookieName(slug))?.value;

  if (!token) {
    return <GuestGate slug={slug} />;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return (
      <MessageState
        slug={slug}
        title="Configuração indisponível"
        message="Não foi possível conectar ao servidor. Tente novamente mais tarde."
      />
    );
  }

  let response: Response;
  let contributionsResponse: Response | null;

  try {
    [response, contributionsResponse] = await Promise.all([
      fetch(
        `${apiUrl}/events/${encodeURIComponent(slug)}/guest/overview`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      ),
      fetch(
        `${apiUrl}/events/${encodeURIComponent(slug)}/guest/contributions`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        },
      ).catch(() => null),
    ]);
  } catch {
    return (
      <MessageState
        slug={slug}
        title="Não foi possível carregar a lista"
        message="Não conseguimos falar com o servidor agora. Tente novamente em instantes."
      />
    );
  }

  if (response.status === 401) {
    return <GuestGate slug={slug} expired />;
  }

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    return (
      <MessageState
        slug={slug}
        title="Algo deu errado"
        message="Não foi possível carregar a lista de presentes. Tente novamente em instantes."
      />
    );
  }

  const { event, guest, gifts }: GuestOverview = await response.json();

  let myContributions: MyContribution[] = [];

  if (contributionsResponse?.ok) {
    try {
      myContributions = await contributionsResponse.json();
    } catch {
      // Continua sem a seção de contribuições caso a resposta seja inválida.
    }
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
    <main className="relative min-h-dvh w-full overflow-x-clip bg-[#fffaf9] text-[#302b28]">
      <section className="relative isolate overflow-hidden border-b border-[#f0dfe2] px-4 py-14 text-center sm:px-6 sm:py-20 lg:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[#fff7f8] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/background.png')" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-[#fffaf9]/65 via-[#fff7f8]/80 to-[#fffaf9]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 -z-10 h-52 w-52 rounded-full bg-[#e8caca]/35 blur-3xl sm:h-72 sm:w-72"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 -z-10 h-60 w-60 rounded-full bg-[#ead6d6]/45 blur-3xl sm:h-80 sm:w-80"
        />

        <div className="mx-auto w-full max-w-4xl rounded-[2rem] border border-white/50 bg-white/20 px-3 py-4 shadow-[0_20px_60px_rgba(115,77,77,0.04)] backdrop-blur-[2px] sm:px-6 sm:py-6">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#a96f75] sm:text-sm sm:tracking-[0.35em]">
            {GUEST_EVENT_KICKER[event.eventType]}
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl break-words font-serif text-3xl leading-tight text-[#302b28] sm:text-5xl md:text-6xl">
            {event.title}
          </h1>
          <p className="mt-4 text-base capitalize text-[#6d5b58] sm:mt-5 sm:text-lg">
            {formattedDate}
          </p>
          <p className="mt-8 text-sm text-[#827573]">
            Olá,{' '}
            <span className="font-semibold text-[#514340]">
              {guest.name}
            </span>{' '}
            · <LeaveButton slug={slug} />
          </p>
        </div>
      </section>

      <MyContributions
        slug={slug}
        contributions={myContributions}
        gifts={gifts}
      />

      <section className="relative overflow-hidden bg-[#fff9f8] px-4 py-14 sm:px-6 sm:py-18 lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#f1dfe0]/45 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-12 h-72 w-72 rounded-full bg-[#f6e9e4]/60 blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-7xl">
          <header className="mx-auto mb-9 max-w-2xl text-center sm:mb-12 lg:mb-14">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#efdadd] bg-white/80 px-3.5 py-2 shadow-sm">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#c4777d]"
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a96f75] sm:text-xs sm:tracking-[0.24em]">
                Uma lembrança para guardar
              </p>
            </div>
            <h2 className="font-serif text-3xl leading-tight tracking-tight text-[#302b28] sm:text-4xl md:text-5xl">
              Escolha algo especial
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#827573] sm:text-base">
              Cada presente é um jeito carinhoso de fazer parte dessa nova história.
            </p>
            <div
              aria-hidden="true"
              className="mx-auto mt-6 h-px w-16 bg-[#d9aeb4]"
            />
          </header>

          {gifts.length === 0 ? (
            <div className="mx-auto max-w-lg rounded-[1.75rem] border border-dashed border-[#e8caca] bg-white/80 px-6 py-10 text-center shadow-[0_12px_36px_rgba(115,77,77,0.04)] sm:px-8 sm:py-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#b47b7f]">
                <GiftIcon size={27} strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 font-serif text-xl text-[#302b28]">
                Os presentes estão chegando
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#827573]">
                Os anfitriões ainda não cadastraram presentes. Volte em breve para conferir a lista.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {gifts.map((gift) => (
                <li
                  key={gift.id}
                  data-gift-id={gift.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-[1.65rem] border border-[#efdddf] bg-white shadow-[0_8px_26px_rgba(95,63,65,0.045)] transition duration-300 hover:-translate-y-1 hover:border-[#dfbdc1] hover:shadow-[0_18px_42px_rgba(95,63,65,0.10)]"
                >
                  <div className="relative flex h-56 shrink-0 items-center justify-center overflow-hidden bg-gradient-to-b from-[#fffdfc] to-[#fff5f5] sm:h-60">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-8 bottom-3 h-5 rounded-full bg-[#e8d6d6]/30 blur-xl"
                    />
                    {gift.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={gift.imageUrl}
                        alt={gift.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="relative h-full w-full object-contain p-5 transition-transform duration-500 group-hover:scale-[1.025]"
                      />
                    ) : (
                      <div className="relative flex h-full w-full items-center justify-center text-[#c4a0a4]">
                        <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/90 bg-white/75 shadow-sm">
                          <GiftIcon size={39} strokeWidth={1.25} />
                        </div>
                      </div>
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#ead2d5] to-transparent"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col p-5">
                    <h3 className="min-h-[3rem] break-words font-serif text-lg leading-snug text-[#302b28] sm:text-xl">
                      {gift.title}
                    </h3>

                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8582]">
                        Valor do presente
                      </p>
                      <p className="text-xl font-bold tracking-tight text-[#a9626b] sm:text-2xl">
                        {formatBRL(gift.price)}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-[#f3e8e8] pt-3">
                      <GiftStatusArea gift={gift} />
                    </div>

                    <div className="mt-auto pt-5">
                      {!isGiftClosed(gift.status) &&
                        gift.availableAmount > 0 && (
                          <div className="space-y-2.5">
                            <GiftClaim slug={slug} gift={gift} />
                            <GiftContribute slug={slug} gift={gift} />
                          </div>
                        )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="border-t border-[#f0dfe2] bg-gradient-to-r from-[#fff8f8] via-[#fffdfc] to-[#fff8f8] px-4 py-7 text-center text-xs text-[#827573] sm:px-6 sm:py-8 sm:text-sm">
        <p>
          Web<span className="italic text-[#b47b7f]">Gift</span> · {event.title}
        </p>
      </footer>
    </main>
  );
}
