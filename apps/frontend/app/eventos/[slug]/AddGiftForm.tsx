'use client';

import { useState, type FormEvent } from 'react';

// Sprint 3 — Dia 3 (Dupla B): o preview agora é REAL — chama
// /api/events/[slug]/gifts/preview (BFF), que repassa pro backend.
//
// Dois tipos de aviso, de propósito diferentes:
// - "E-commerce não suportado" (422 + UNSUPPORTED_ECOMMERCE): a loja está
//   fora do escopo do MVP (só Mercado Livre e Amazon). Cai direto pro
//   preenchimento manual.
// - "Não veio algum campo" (200 + missingFields): a loja é suportada, mas o
//   auto-fetch não trouxe tudo. É o caso NORMAL — no Mercado Livre o preço
//   nunca vem. Não é erro: o campo só fica destacado pra o dono preencher.
//
// O botão "Salvar presente" só chega no Dia 4 (POST /events/:slug/gifts).

type MissingField = 'title' | 'imageUrl' | 'price';

type PreviewResponse = {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  source: string | null;
  store: 'mercadolivre' | 'amazon';
  missingFields: MissingField[];
};

type ApiErrorBody = {
  code?: string;
  message?: string | string[];
};

type Mode = 'idle' | 'preview' | 'manual';

type Notice = { kind: 'info' | 'warning'; text: string };

const STORE_LABEL: Record<PreviewResponse['store'], string> = {
  mercadolivre: 'Mercado Livre',
  amazon: 'Amazon',
};

const FIELD_LABEL: Record<MissingField, string> = {
  title: 'o nome do produto',
  imageUrl: 'a imagem',
  price: 'o preço',
};

function isLikelyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function firstMessage(body: ApiErrorBody, fallback: string): string {
  if (Array.isArray(body.message)) return body.message[0] ?? fallback;
  return body.message ?? fallback;
}

// Monta o aviso do caso "loja suportada, mas faltou campo".
function buildMissingNotice(preview: PreviewResponse): Notice | null {
  const missing = preview.missingFields;
  if (missing.length === 0) return null;

  if (missing.length === 3) {
    return {
      kind: 'warning',
      text: 'Não conseguimos ler nenhum dado automaticamente desse link. Preencha os campos abaixo.',
    };
  }

  // Mercado Livre: o preço nunca vem — avisamos de forma direta, sem tom de erro.
  if (missing.length === 1 && missing[0] === 'price' && preview.store === 'mercadolivre') {
    return {
      kind: 'info',
      text: 'O Mercado Livre não informa o preço automaticamente — digite o valor abaixo.',
    };
  }

  const names = missing.map((field) => FIELD_LABEL[field]).join(' e ');
  return {
    kind: 'warning',
    text: `Não encontramos ${names} automaticamente — complete abaixo.`,
  };
}

export default function AddGiftForm({ slug }: { slug: string }) {
  const [url, setUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [store, setStore] = useState<PreviewResponse['store'] | null>(null);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetResult() {
    setError(null);
    setNotice(null);
    setMode('idle');
    setStore(null);
    setMissing([]);
    setTitle('');
    setImageUrl('');
    setPrice('');
  }

  function startManual(message?: Notice) {
    setError(null);
    setStore(null);
    setMissing([]);
    setMode('manual');
    setNotice(message ?? null);
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    resetResult();

    if (!isLikelyUrl(url)) {
      setError('Cole um link válido (começando com http:// ou https://).');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/events/${slug}/gifts/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const preview = data as PreviewResponse;
        setStore(preview.store);
        setMissing(preview.missingFields);
        setTitle(preview.title ?? '');
        setImageUrl(preview.imageUrl ?? '');
        setPrice(preview.price !== null ? String(preview.price).replace('.', ',') : '');
        setNotice(buildMissingNotice(preview));
        setMode('preview');
        return;
      }

      const body = data as ApiErrorBody;

      if (response.status === 422 && body.code === 'UNSUPPORTED_ECOMMERCE') {
        startManual({
          kind: 'warning',
          text:
            'Essa loja ainda não tem preenchimento automático — por enquanto só Mercado Livre ' +
            'e Amazon. Preencha os dados do presente manualmente.',
        });
        return;
      }

      if (response.status === 401) {
        setError('Sua sessão expirou. Entre de novo para continuar.');
      } else if (response.status === 404) {
        setError('Evento não encontrado.');
      } else if (response.status === 429) {
        setError('Muitas buscas seguidas. Aguarde um minuto e tente de novo.');
      } else if (response.status === 400) {
        setError(firstMessage(body, 'Link inválido.'));
      } else {
        setError('Não foi possível buscar os dados agora. Tente de novo ou preencha manualmente.');
      }
    } catch {
      setError('Não foi possível falar com o servidor. Tente de novo ou preencha manualmente.');
    } finally {
      setIsSearching(false);
    }
  }

  const showForm = mode === 'preview' || mode === 'manual';
  const highlight = (field: MissingField) =>
    mode === 'preview' && missing.includes(field)
      ? 'border-amber-300 bg-amber-50/50'
      : 'border-gray-200';

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Adicionar presente</h2>
        {store && (
          <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700">
            {STORE_LABEL[store]}
          </span>
        )}
      </div>

      <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link do produto (Mercado Livre ou Amazon)"
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

      {mode === 'idle' && !isSearching && (
        <button
          type="button"
          onClick={() => startManual()}
          className="mt-3 text-sm font-medium text-pink-600 hover:underline"
        >
          Prefiro preencher manualmente
        </button>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-600">
          <p>{error}</p>
          {mode === 'idle' && (
            <button
              type="button"
              onClick={() => startManual()}
              className="mt-1 font-medium text-pink-600 hover:underline"
            >
              Preencher manualmente
            </button>
          )}
        </div>
      )}

      {notice && (
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            notice.kind === 'info' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {showForm && (
        <div className="mt-5 flex flex-col gap-4 rounded-xl border border-pink-100 bg-pink-50/60 p-4 sm:flex-row">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-white text-xs text-gray-400">
              sem imagem
            </div>
          )}

          <div className="flex flex-1 flex-col gap-3">
            <label className="text-sm font-medium text-gray-600">
              Nome do presente
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`mt-1 w-full rounded-xl border px-4 py-2 text-gray-700 outline-none focus:border-pink-400 ${highlight('title')}`}
              />
            </label>

            <label className="text-sm font-medium text-gray-600">
              Preço (R$)
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex: 249,90"
                className={`mt-1 w-full rounded-xl border px-4 py-2 text-gray-700 outline-none focus:border-pink-400 ${highlight('price')}`}
              />
            </label>

            {(mode === 'manual' || missing.includes('imageUrl')) && (
              <label className="text-sm font-medium text-gray-600">
                Link da imagem (opcional)
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className={`mt-1 w-full rounded-xl border px-4 py-2 text-gray-700 outline-none focus:border-pink-400 ${highlight('imageUrl')}`}
                />
              </label>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Evento: <span className="font-medium text-gray-500">{slug}</span> · o botão &quot;Salvar
        presente&quot; chega no Dia 4 desta sprint, junto com o cadastro real.
      </p>
    </div>
  );
}
