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
} from '../../lib/guest';
import GiftClaim from './GiftClaim';
import GiftContribute from './GiftContribute';
import GuestGate from './GuestGate';
import LeaveButton from './LeaveButton';

// Página PÚBLICA do evento (o link que o dono compartilha: /<slug>).
// Sprint 4, Dia 1: dados reais; Dia 2: reservar cota; Dia 3: presente completo. Fluxo:
//   sem cookie de sessão  → porta de entrada (senha + nome)
//   com cookie            → busca a visão do convidado no backend
//   backend diz 401       → sessão vencida/inválida → porta de entrada
//   backend diz 404       → evento não existe
function MessageState({ slug, title, message }: { slug: string; title: string; message: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#fff8fb] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[#f0dfe2] bg-white/90 p-8 text-center shadow-[0_16px_45px_rgba(115,77,77,0.08)]">
        <h1 className="font-serif text-2xl text-[#302b28]">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#827573]">{message}</p>
        {/* <a> comum (não onClick) porque esta página é Server Component. */}
        <a
          href={`/${slug}`}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72]"
        >
          Tentar novamente
        </a>
      </div>
    </main>
  );
}

function GiftStatusArea({ gift }: { gift: GuestGift }) {
  if (isGiftClosed(gift.status) || gift.availableAmount <= 0) {
    return (
      <p className="mt-4 rounded-lg bg-[#f6f1f1] px-3 py-2 text-center text-sm font-medium text-[#827573]">
        Já garantido por um convidado
      </p>
    );
  }

  const hasShares = gift.reservedAmount > 0;
  const percent = Math.min(100, Math.round((gift.reservedAmount / gift.price) * 100));

  return (
    <div className="mt-4">
      {hasShares ? (
        <>
          <div
            className="h-2 overflow-hidden rounded-full bg-[#f3e4e6]"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Quanto do presente já foi garantido em cotas"
          >
            <div className="h-full rounded-full bg-[#c4777d]" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#827573]">
            {formatBRL(gift.reservedAmount)} já garantidos · faltam {formatBRL(gift.availableAmount)}
          </p>
        </>
      ) : (
        <p className="text-xs text-[#827573]">Ninguém escolheu este presente ainda</p>
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
  try {
    response = await fetch(`${apiUrl}/events/${encodeURIComponent(slug)}/guest/overview`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
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
    // Sessão vencida ou de outro evento. Não dá pra apagar o cookie daqui
    // (Server Component); o próprio login seguinte o sobrescreve.
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

  // timeZone UTC: a data vem como meia-noite UTC; no Brasil (UTC-3) sem isso
  // apareceria o dia anterior. Mesmo tratamento do painel do dono.
  const formattedDate = new Date(event.eventDate).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="min-h-dvh bg-[#fff8fb] text-[#302b28]">
      {/* HERO */}
      <section className="bg-gradient-to-b from-[#f3dfe4] to-[#fff8fb] px-6 py-16 text-center sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#b47b7f] sm:text-sm">
          {GUEST_EVENT_KICKER[event.eventType]}
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl break-words font-serif text-4xl sm:text-6xl">
          {event.title}
        </h1>
        <p className="mt-5 text-lg capitalize text-[#6d5b58]">{formattedDate}</p>
        <p className="mt-8 text-sm text-[#827573]">
          Olá, <span className="font-semibold text-[#514340]">{guest.name}</span>! ·{' '}
          <LeaveButton slug={slug} />
        </p>
      </section>

      {/* PRESENTES */}
      <section className="bg-white px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b47b7f]">
              Lista de presentes
            </p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">Escolha um presente 🎁</h2>
          </div>

          {gifts.length === 0 ? (
            <p className="mx-auto max-w-md rounded-2xl border border-dashed border-[#e8caca] px-6 py-10 text-center text-sm text-[#827573]">
              Os anfitriões ainda não cadastraram presentes. Volte em breve!
            </p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {gifts.map((gift) => (
                <li
                  key={gift.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#f0dfe2] bg-white shadow-sm"
                >
                  {gift.imageUrl ? (
                    // <img> comum: as imagens vêm por hotlink de lojas (Mercado
                    // Livre/Amazon). referrerPolicy evita bloqueio por referer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={gift.imageUrl}
                      alt={gift.title}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="h-52 w-full bg-white object-contain p-2"
                    />
                  ) : (
                    <div className="flex h-52 w-full items-center justify-center bg-[#fff5f6] text-[#c4a0a4]">
                      <GiftIcon size={48} strokeWidth={1.3} />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="break-words text-lg font-semibold leading-snug">{gift.title}</h3>
                    <p className="mt-3 text-2xl font-bold text-[#c4777d]">{formatBRL(gift.price)}</p>

                    <GiftStatusArea gift={gift} />

                    {/* Dia 3: presentear por completo (Pix ou link da loja). Dia 2: cota. */}
                    {!isGiftClosed(gift.status) && gift.availableAmount > 0 && (
                      <div className="mt-5 space-y-2">
                        <GiftClaim slug={slug} gift={gift} />
                        <GiftContribute slug={slug} gift={gift} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="border-t border-[#f0dfe2] bg-white px-6 py-8 text-center text-sm text-[#827573]">
        <p>
          Web<span className="italic text-[#b47b7f]">Gift</span> · {event.title}
        </p>
      </footer>
    </main>
  );
}
