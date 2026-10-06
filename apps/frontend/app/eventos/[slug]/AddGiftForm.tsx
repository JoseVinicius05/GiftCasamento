'use client';

import { useState, type FormEvent } from 'react';

// Sprint 3 — Dia 1 (Dupla B): só a casca da tela de "Adicionar presente".
// O preview abaixo é MOCK LOCAL, deliberadamente marcado como tal na UI
// (badge "simulado") pra não repetir o erro da página pública do convidado,
// que ficou mostrando dado fictício sem deixar isso claro.
//
// Nos próximos dias desta sprint:
// - Dia 2: service de metadados no backend (Microlink ou equivalente).
// - Dia 3: POST /events/:slug/gifts de verdade, substituindo este mock pela
//   chamada real via /api/events/[slug]/gifts (mesmo padrão BFF já usado
//   em /api/events).

type MockPreview = {
  title: string;
  imageUrl: string;
  price: number | null;
};

function isLikelyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Dado fixo só pra dar feedback visual de como o preview vai se comportar
// quando a busca de metadados for ligada de verdade (Dia 2/3). Price null
// representa o caso real de um site que não expõe preço nos metadados.
function buildMockPreview(url: string): MockPreview {
  const semPreco = url.includes('semfoto') || url.length % 2 === 0;
  return {
    title: 'Jogo de panelas antiaderente (preview simulado)',
    imageUrl: 'https://placehold.co/160x160?text=Preview',
    price: semPreco ? null : 249.9,
  };
}

export default function AddGiftForm({ slug }: { slug: string }) {
  const [url, setUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<MockPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPreview(null);

    if (!isLikelyUrl(url)) {
      setError('Cole um link válido (começando com http:// ou https://).');
      return;
    }

    setIsSearching(true);
    // Simula a latência de uma chamada real; substituído por fetch de
    // verdade no Dia 2/3 desta sprint.
    await new Promise((resolve) => setTimeout(resolve, 600));
    setPreview(buildMockPreview(url));
    setIsSearching(false);
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Adicionar presente</h2>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          Preview simulado — integração real chega nos próximos dias
        </span>
      </div>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link do produto (ex: loja.com/produto)"
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-gray-700 outline-none focus:border-pink-400"
        />
        <button
          type="submit"
          disabled={isSearching || url.length === 0}
          className="rounded-xl bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {preview && (
        <div className="mt-5 flex items-center gap-4 rounded-xl border border-pink-100 bg-pink-50/60 p-4">
          <img
            src={preview.imageUrl}
            alt=""
            className="h-16 w-16 rounded-lg object-cover"
          />
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{preview.title}</p>
            {preview.price !== null ? (
              <p className="text-sm text-gray-500">
                {preview.price.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            ) : (
              <p className="text-sm text-amber-600">
                Não encontramos o preço automaticamente — você vai poder digitar na próxima etapa.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Evento: <span className="font-medium text-gray-500">{slug}</span> · o botão &quot;Salvar
        presente&quot; chega no Dia 3 desta sprint, junto com o endpoint real.
      </p>
    </div>
  );
}
