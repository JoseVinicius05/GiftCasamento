import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TOKEN_COOKIE } from '../../../lib/auth-cookie';
import EditEventForm from './EditEventForm';

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
  pixKey: string;
};

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
  const response = await fetch(`${apiUrl}/events/${slug}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  // 401 (token inválido/expirado) ou 404 (não existe ou não é seu) —
  // nos dois casos a pessoa não tem o que ver aqui.
  if (response.status === 401) {
    redirect(`/login?redirectTo=/eventos/${slug}`);
  }
  if (!response.ok) {
    redirect('/meus-eventos');
  }

  const event: Event = await response.json();
  // O input type="date" espera "YYYY-MM-DD"; o backend manda um ISO completo.
  const eventDateForInput = event.eventDate.slice(0, 10);

  return (
    <main className="min-h-screen bg-[#fff8fb] px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-pink-500">
            {EVENT_TYPE_LABELS[event.eventType]}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-gray-800">{event.title}</h1>
          <p className="mt-2 text-gray-500">
            {new Date(event.eventDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </p>

          <div className="mt-4 rounded-xl bg-pink-50 px-4 py-3 text-sm text-gray-600">
            Link do evento:{' '}
            <span className="font-medium text-gray-800">webgift.com/evento/{event.slug}</span>
          </div>
        </div>

        {/* Lista de presentes chega na Sprint 3 */}
        <div className="rounded-2xl border-2 border-dashed border-pink-200 bg-white/60 p-6 text-center text-gray-500">
          A lista de presentes deste evento chega na Sprint 3.
        </div>

        <EditEventForm
          slug={event.slug}
          initialTitle={event.title}
          initialEventType={event.eventType}
          initialEventDate={eventDateForInput}
          initialPixKey={event.pixKey}
        />
      </div>
    </main>
  );
}
