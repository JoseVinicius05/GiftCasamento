import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TOKEN_COOKIE } from '../../lib/auth-cookie';

type EventTypeValue = 'casamento' | 'aniversario' | 'cha_de_bebe' | 'cha_de_cozinha' | 'outro';

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
};

// Server component (igual ao /dashboard): lê o cookie, repassa o token pro
// backend via header, nunca expõe o JWT pro navegador.
export default async function MeusEventosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    redirect('/login?redirectTo=/meus-eventos');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const response = await fetch(`${apiUrl}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    redirect('/login?redirectTo=/meus-eventos');
  }

  const events: Event[] = await response.json();

  return (
    <main className="min-h-screen bg-[#fff8fb] px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Meus eventos</h1>

          <Link
            href="/criar-casamento"
            className="rounded-xl bg-pink-500 px-5 py-3 font-semibold text-white transition hover:bg-pink-600"
          >
            + Novo evento
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-gray-500">Você ainda não criou nenhum evento.</p>
            <Link
              href="/criar-casamento"
              className="mt-4 inline-block font-semibold text-pink-500 hover:underline"
            >
              Criar meu primeiro evento
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/eventos/${event.slug}`}
                  className="block rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-pink-500">
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-gray-800">{event.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(event.eventDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
