import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { TOKEN_COOKIE } from '../../../lib/auth-cookie';
import EditEventForm from './EditEventForm';
import AddGiftForm from './AddGiftForm';
import GiftList from './GiftList';
import type { Gift } from '../../../lib/gifts';

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
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/events/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    // Backend fora do ar ou inacessível — isso é diferente de "não existe",
    // então mostramos um erro de verdade em vez de mandar pro /meus-eventos
    // como se o evento não existisse.
    return (
      <main className="min-h-screen bg-[#fff8fb] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-800">Não foi possível carregar o evento</h1>
          <p className="mt-2 text-gray-500">
            Não conseguimos falar com o servidor agora. Tente novamente em instantes.
          </p>
        </div>
      </main>
    );
  }

  // 401 (token inválido/expirado): manda pro login.
  if (response.status === 401) {
    redirect(`/login?redirectTo=/eventos/${slug}`);
  }
  // 404 (não existe ou não é seu): manda pra lista, sem revelar qual dos dois.
  if (response.status === 404) {
    redirect('/meus-eventos');
  }
  // Qualquer outro erro (5xx, etc.) é um problema de servidor de verdade —
  // mostra mensagem em vez de redirecionar como se o evento não existisse.
  if (!response.ok) {
    return (
      <main className="min-h-screen bg-[#fff8fb] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-800">Algo deu errado</h1>
          <p className="mt-2 text-gray-500">
            Não foi possível carregar os dados do evento. Tente novamente em instantes.
          </p>
        </div>
      </main>
    );
  }

  const event: Event = await response.json();
  // O input type="date" espera "YYYY-MM-DD"; o backend manda um ISO completo.
  const eventDateForInput = event.eventDate.slice(0, 10);

  // Presentes do evento. Se essa chamada falhar, o painel NÃO quebra: mostra
  // o evento normalmente e um aviso no lugar da lista.
  let gifts: Gift[] = [];
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

        {/* Sprint 3, Dia 3/4: preview real + salvar. Depois de salvar, o
            formulário chama router.refresh() e a lista abaixo atualiza. */}
        <AddGiftForm slug={event.slug} />

        <GiftList slug={event.slug} gifts={gifts} loadFailed={giftsLoadFailed} />

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
