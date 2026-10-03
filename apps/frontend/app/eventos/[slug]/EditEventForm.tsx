'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type EventTypeValue = 'casamento' | 'aniversario' | 'cha_de_bebe' | 'cha_de_cozinha' | 'outro';

const EVENT_TYPES: { value: EventTypeValue; label: string }[] = [
  { value: 'casamento', label: 'Casamento' },
  { value: 'aniversario', label: 'Aniversário' },
  { value: 'cha_de_bebe', label: 'Chá de bebê' },
  { value: 'cha_de_cozinha', label: 'Chá de cozinha' },
  { value: 'outro', label: 'Outro' },
];

type Props = {
  slug: string;
  initialTitle: string;
  initialEventType: EventTypeValue;
  initialEventDate: string; // formato YYYY-MM-DD, pronto pro <input type="date">
  initialPixKey: string;
};

// Formulário de edição simples, próprio desta tela. Não reaproveita o
// componente de /criar-casamento: aquela tela ganhou uma identidade visual
// bem mais elaborada (seletor de ícones, animações) que eu não construí, e
// eu preferi não mexer nela pra não arriscar quebrar esse trabalho. Se vocês
// quiserem de fato um componente único compartilhado entre criar e editar,
// me avisem — aí faz sentido extrair aquele formulário pra um componente à parte.
export default function EditEventForm({
  slug,
  initialTitle,
  initialEventType,
  initialEventDate,
  initialPixKey,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [eventType, setEventType] = useState<EventTypeValue>(initialEventType);
  const [eventDate, setEventDate] = useState(initialEventDate);
  const [pixKey, setPixKey] = useState(initialPixKey);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!title.trim()) {
      setError('O título não pode ficar vazio.');
      return;
    }
    if (!pixKey.trim()) {
      setError('A chave Pix não pode ficar vazia.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, eventType, eventDate, pixKey }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?redirectTo=/eventos/${slug}`);
          return;
        }
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(message ?? 'Não foi possível salvar as alterações.');
        return;
      }

      setSuccess(true);
      router.refresh(); // atualiza os dados mostrados acima do formulário
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-800">Editar evento</h2>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Alterações salvas.
        </div>
      )}

      <div>
        <label htmlFor="edit-title" className="mb-2 block text-sm font-semibold text-gray-700">
          Título
        </label>
        <input
          id="edit-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
        />
      </div>

      <div>
        <label htmlFor="edit-type" className="mb-2 block text-sm font-semibold text-gray-700">
          Tipo de evento
        </label>
        <select
          id="edit-type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventTypeValue)}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-800 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
        >
          {EVENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="edit-date" className="mb-2 block text-sm font-semibold text-gray-700">
          Data do evento
        </label>
        <input
          id="edit-date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
        />
      </div>

      <div>
        <label htmlFor="edit-pix" className="mb-2 block text-sm font-semibold text-gray-700">
          Chave Pix
        </label>
        <input
          id="edit-pix"
          type="text"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-600 disabled:opacity-50"
      >
        {loading ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  );
}
