
'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Link2,
  LoaderCircle,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
} from 'lucide-react';

import { firstApiMessage, parsePriceInput } from '../../../lib/gifts';

type MissingField = 'title' | 'imageUrl' | 'price';

type PreviewResponse = {
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  source: string | null;
  store: 'mercadolivre' | 'amazon';
  missingFields: MissingField[];
  resolvedUrl: string;
};

type ApiErrorBody = {
  code?: string;
  message?: string | string[];
};

type Mode = 'idle' | 'preview' | 'manual';

type Notice = {
  kind: 'info' | 'warning';
  text: string;
};

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

function buildMissingNotice(preview: PreviewResponse): Notice | null {
  const missing = preview.missingFields;

  if (missing.length === 0) return null;

  if (missing.length === 3) {
    return {
      kind: 'warning',
      text: 'Não conseguimos ler nenhum dado automaticamente desse link. Preencha os campos abaixo.',
    };
  }

  if (
    missing.length === 1 &&
    missing[0] === 'price' &&
    preview.store === 'mercadolivre'
  ) {
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

const inputClass =
  'mt-2 w-full min-w-0 rounded-xl border border-[#e7d9d8] bg-white/80 px-4 py-3 text-base text-[#302b28] outline-none transition placeholder:text-[#a59a96] focus:border-[#b47b7f] focus:ring-4 focus:ring-[#b47b7f]/10';

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
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [autoPrice, setAutoPrice] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  const router = useRouter();

  function resetResult() {
    setError(null);
    setNotice(null);
    setMode('idle');
    setStore(null);
    setMissing([]);
    setTitle('');
    setImageUrl('');
    setPrice('');
    setResolvedUrl(null);
    setAutoPrice(null);
    setSaveError(null);
    setSavedTitle(null);
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
      setError('Cole um link válido começando com http:// ou https://.');
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
        setPrice(
          preview.price !== null
            ? String(preview.price).replace('.', ',')
            : '',
        );
        setResolvedUrl(preview.resolvedUrl);
        setAutoPrice(preview.price);
        setNotice(buildMissingNotice(preview));
        setMode('preview');
        return;
      }

      const body = data as ApiErrorBody;

      if (
        response.status === 422 &&
        body.code === 'UNSUPPORTED_ECOMMERCE'
      ) {
        startManual({
          kind: 'warning',
          text:
            'Essa loja ainda não tem preenchimento automático. Por enquanto, só Mercado Livre e Amazon. Preencha os dados manualmente.',
        });
        return;
      }

      if (
        response.status === 422 &&
        body.code === 'SHORT_LINK_UNRESOLVED'
      ) {
        startManual({
          kind: 'warning',
          text:
            firstMessage(body, '') ||
            'Não conseguimos abrir esse link encurtado. Cole o link completo do produto ou preencha manualmente.',
        });
        return;
      }

      if (response.status === 401) {
        setError('Sua sessão expirou. Entre novamente para continuar.');
      } else if (response.status === 404) {
        setError('Evento não encontrado.');
      } else if (response.status === 429) {
        setError('Muitas buscas seguidas. Aguarde um minuto e tente novamente.');
      } else if (response.status === 400) {
        setError(firstMessage(body, 'Link inválido.'));
      } else {
        setError(
          'Não foi possível buscar os dados agora. Tente novamente ou preencha manualmente.',
        );
      }
    } catch {
      setError(
        'Não foi possível falar com o servidor. Tente novamente ou preencha manualmente.',
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    setSaveError(null);

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setSaveError('Dê um nome para o presente.');
      return;
    }

    const parsedPrice = parsePriceInput(price);

    if (parsedPrice === null) {
      setSaveError('Informe um preço válido, por exemplo 249,90.');
      return;
    }

    const typedUrl = url.trim();

    const productUrl =
      mode === 'preview'
        ? resolvedUrl ?? typedUrl
        : isLikelyUrl(typedUrl)
          ? typedUrl
          : undefined;

    const priceSource =
      mode === 'preview' &&
        autoPrice !== null &&
        autoPrice === parsedPrice
        ? 'auto'
        : 'manual';

    setIsSaving(true);

    try {
      const response = await fetch(`/api/events/${slug}/gifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          price: parsedPrice,
          priceSource,
          ...(productUrl && { productUrl }),
          ...(imageUrl.trim() && { imageUrl: imageUrl.trim() }),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        resetResult();
        setUrl('');
        setSavedTitle(trimmedTitle);
        router.refresh();
        return;
      }

      if (response.status === 401) {
        setSaveError('Sua sessão expirou. Entre novamente para continuar.');
      } else if (response.status === 404) {
        setSaveError('Evento não encontrado.');
      } else {
        setSaveError(
          firstApiMessage(data, 'Não foi possível salvar agora. Tente novamente.'),
        );
      }
    } catch {
      setSaveError('Não foi possível falar com o servidor. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  const showForm = mode === 'preview' || mode === 'manual';

  const highlight = (field: MissingField) =>
    mode === 'preview' && missing.includes(field)
      ? 'border-amber-300 bg-amber-50/70 focus:border-amber-400 focus:ring-amber-200/50'
      : '';

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-[24px] border border-white/80 bg-white/65 p-4 shadow-[0_16px_50px_rgba(87,57,54,0.08)] backdrop-blur-2xl sm:rounded-[28px] sm:p-6 lg:p-7">
      {/* Brilho decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#e8caca]/30 blur-3xl"
      />

      <div className="relative">
        {/* Cabeçalho */}
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e9d4d4] bg-[#f7e8e8] text-[#a96f75] sm:h-12 sm:w-12">
            <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-xl text-[#302b28] sm:text-2xl">
                Adicionar presente
              </h2>

              {store && (
                <span className="inline-flex items-center rounded-full border border-[#e8d2d1] bg-[#f8eded] px-2.5 py-1 text-[10px] font-semibold text-[#945f65] sm:text-xs">
                  {STORE_LABEL[store]}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm leading-5 text-[#857874]">
              Encontre o produto e adicione-o à sua lista de presentes.
            </p>
          </div>
        </div>

        {/* Lojas compatíveis */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#8e817c]">Busca automática:</span>
          <span className="rounded-full border border-[#e6dcd8] bg-white/70 px-3 py-1 text-xs font-medium text-[#625752]">
            Mercado Livre
          </span>
          <span className="rounded-full border border-[#e6dcd8] bg-white/70 px-3 py-1 text-xs font-medium text-[#625752]">
            Amazon
          </span>
        </div>

        {/* Busca */}
        <form
          onSubmit={handleSearch}
          className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row"
        >
          <label htmlFor={`gift-url-${slug}`} className="sr-only">
            Link do produto
          </label>

          <div className="relative min-w-0 flex-1">
            <Link2
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#b18a8b]"
            />

            <input
              id={`gift-url-${slug}`}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Cole o link do produto..."
              autoComplete="url"
              className="w-full min-w-0 rounded-xl border border-[#e7d9d8] bg-white/85 py-3 pl-11 pr-4 text-base text-[#302b28] outline-none transition placeholder:text-[#a59a96] focus:border-[#b47b7f] focus:ring-4 focus:ring-[#b47b7f]/10"
            />
          </div>

          <button
            type="submit"
            disabled={isSearching || url.trim().length === 0}
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c4777d] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-[#b47b7f]/15 transition duration-300 hover:-translate-y-0.5 hover:bg-[#b66b72] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto"
          >
            {isSearching ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Buscar produto
              </>
            )}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode("manual");
            setNotice(null);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-full
             border border-[#b47b7f]/30 bg-white/60 mt-3
             px-3 py-2 text-sm font-medium text-[#9d646a]
             transition hover:border-[#b47b7f]/60
             hover:bg-[#fff1f2] active:scale-[0.98]"
        >
          <span className="text-base leading-none">+</span>
          Adicionar manualmente
        </button>

        <p className="mt-2 text-xs leading-5 text-[#968984]">
          Cole o endereço completo do produto. Você poderá revisar os dados
          antes de salvar.
        </p>

        {/* Erros da busca */}
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50/80 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0 flex-1">
              <p>{error}</p>

              {mode === 'idle' && (
                <button
                  type="button"
                  onClick={() => startManual()}
                  className="mt-2 font-semibold text-[#a55e67] underline decoration-[#d6a9ad] underline-offset-4 transition hover:text-[#80474e]"
                >
                  Preencher manualmente
                </button>
              )}
            </div>
          </div>
        )}

        {/* Avisos de preenchimento automático */}
        {notice && (
          <div
            role="status"
            className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${notice.kind === 'info'
              ? 'border-sky-200/80 bg-sky-50/80 text-sky-800'
              : 'border-amber-200/80 bg-amber-50/80 text-amber-800'
              }`}
          >
            {notice.kind === 'info' ? (
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <p className="min-w-0">{notice.text}</p>
          </div>
        )}

        {/* Formulário de revisão do presente */}
        {showForm && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#ead8d7] bg-gradient-to-br from-[#fff9f9]/95 to-white/80 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#b47b7f]" />
              <h3 className="font-serif text-lg text-[#302b28]">
                Revise os detalhes
              </h3>
            </div>

            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
              {/* Prévia da imagem */}
              <div className="w-full shrink-0 sm:w-32">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-[#eadfdd] bg-white/80 sm:aspect-square">
                  {imageUrl.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={title ? `Imagem de ${title}` : 'Imagem do produto'}
                      className="absolute inset-0 h-full w-full object-contain p-2"
                    />
                  ) : (
                    <div className="flex h-full min-h-36 flex-col items-center justify-center gap-2 p-4 text-center text-[#aa9b96]">
                      <ImagePlus className="h-8 w-8" />
                      <span className="text-xs">Imagem não disponível</span>
                    </div>
                  )}
                </div>

                {mode === 'preview' && resolvedUrl && (
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-[#a56c72] transition hover:bg-[#f5e6e6]"
                  >
                    Ver produto original
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {/* Campos */}
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-4">
                <label className="block min-w-0 text-sm font-medium text-[#625752]">
                  Nome do presente
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Cafeteira elétrica"
                    className={`${inputClass} ${highlight('title')}`}
                  />
                  {mode === 'preview' && missing.includes('title') && (
                    <span className="mt-1.5 block text-xs font-normal text-amber-700">
                      Confira e preencha o nome do produto.
                    </span>
                  )}
                </label>

                <label className="block min-w-0 text-sm font-medium text-[#625752]">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-[#b47b7f]" />
                    Preço (R$)
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex.: 249,90"
                    className={`${inputClass} ${highlight('price')}`}
                  />

                  {mode === 'preview' && missing.includes('price') && (
                    <span className="mt-1.5 block text-xs font-normal text-amber-700">
                      Informe o preço atual do produto.
                    </span>
                  )}
                </label>

                {(mode === 'manual' || missing.includes('imageUrl')) && (
                  <label className="block min-w-0 text-sm font-medium text-[#625752]">
                    Link da imagem
                    <span className="ml-1 text-xs font-normal text-[#a59a96]">
                      (opcional)
                    </span>

                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className={`${inputClass} ${highlight('imageUrl')}`}
                    />

                    {mode === 'preview' && missing.includes('imageUrl') && (
                      <span className="mt-1.5 block text-xs font-normal text-amber-700">
                        Se desejar, adicione o link da imagem do produto.
                      </span>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Erro ao salvar */}
            {saveError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="min-w-0">{saveError}</p>
              </div>
            )}

            <div className="mt-5 border-t border-[#eadfdd] pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c4777d] px-6 py-3 font-semibold text-white shadow-md shadow-[#b47b7f]/15 transition duration-300 hover:-translate-y-0.5 hover:bg-[#b66b72] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isSaving ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Salvando presente...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-5 w-5" />
                    Salvar presente
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-xs leading-5 text-[#968984]">
                Confira o nome e o preço antes de adicionar à sua lista.
              </p>
            </div>
          </div>
        )}

        {/* Confirmação */}
        {savedTitle && !showForm && (
          <div
            role="status"
            className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

            <div className="min-w-0">
              <p className="font-semibold text-emerald-800">
                Presente adicionado!
              </p>
              <p className="mt-1 break-words text-sm text-emerald-700">
                &quot;{savedTitle}&quot; foi adicionado à sua lista.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
