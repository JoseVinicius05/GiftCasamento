'use client';

import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Gift as GiftIcon,
  Image as ImageIcon,
  LoaderCircle,
  Pencil,
  Save,
  ShoppingBag,
  X,
  Trash2,
} from 'lucide-react';

import {
  firstApiMessage,
  formatBRL,
  GIFT_STATUS_LABEL,
  parsePriceInput,
  PRICE_EDITABLE_STATUSES,
  type Gift,
} from '../../../lib/gifts';

const inputClass =
  'w-full min-w-0 rounded-xl border border-[#e8d8d8] bg-white/80 px-3 py-2.5 text-base text-[#302b28] outline-none transition placeholder:text-[#a69a98] focus:border-[#b47b7f] focus:ring-4 focus:ring-[#b47b7f]/10 disabled:cursor-not-allowed disabled:bg-[#f6f1f0] disabled:text-[#a69a98]';

function GiftCard({ slug, gift }: { slug: string; gift: Gift }) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(gift.title);
  const [price, setPrice] = useState(String(gift.price).replace('.', ','));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const canEditPrice = PRICE_EDITABLE_STATUSES.includes(gift.status);

  function startEditing() {
    setTitle(gift.title);
    setPrice(String(gift.price).replace('.', ','));
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setTitle(gift.title);
    setPrice(String(gift.price).replace('.', ','));
    setError(null);
    setIsEditing(false);
  }

  async function handleDelete() {
    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/events/${slug}/gifts/${gift.id}`,
        { method: 'DELETE' },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setError('Sua sessão expirou. Entre novamente para continuar.');
        } else if (response.status === 404) {
          setError('Esse presente não existe mais.');
        } else {
          setError(
            firstApiMessage(data, 'Não foi possível excluir o presente.'),
          );
        }
        return;
      }

      setShowDeleteConfirmation(false);
      setIsEditing(false);
      router.refresh();
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('O nome do presente não pode ficar vazio.');
      return;
    }

    const body: { title?: string; price?: number } = {};

    if (trimmedTitle !== gift.title) {
      body.title = trimmedTitle;
    }

    if (canEditPrice) {
      const parsed = parsePriceInput(price);

      if (parsed === null) {
        setError('Informe um preço válido, por exemplo 249,90.');
        return;
      }

      if (parsed !== gift.price) {
        body.price = parsed;
      }
    }

    if (Object.keys(body).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/events/${slug}/gifts/${gift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
        return;
      }

      if (response.status === 401) {
        setError('Sua sessão expirou. Entre novamente para continuar.');
      } else if (response.status === 404) {
        setError('Esse presente não existe mais.');
      } else {
        setError(
          firstApiMessage(data, 'Não foi possível salvar agora. Tente de novo.'),
        );
      }
    } catch {
      setError('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <li className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-sm transition hover:shadow-md">
        <div className="flex h-full min-w-0 flex-col gap-3 p-4">
          {/* Imagem do presente */}
          <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl border border-[#eee1df] bg-[#fff5f5]">
            {gift.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gift.imageUrl}
                alt={gift.title}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#bba8a5]">
                <ImageIcon size={26} strokeWidth={1.5} />
                <span className="text-xs">Sem imagem</span>
              </div>
            )}
          </div>

          {/* Informações */}
          <div className="flex min-w-0 flex-col items-start gap-2">

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 flex-col items-start gap-2">
                <h3 className="w-full break-words text-sm font-semibold leading-snug text-[#302b28]">
                  {gift.title}
                </h3>

                <span className="inline-flex max-w-full items-center rounded-full border border-[#e8caca]/60 bg-[#fff0f1] px-2 py-1 text-[10px] font-semibold leading-tight text-[#9d646a]">
                  {GIFT_STATUS_LABEL[gift.status]}
                </span>
              </div>

              <p className="mt-3 text-lg font-bold tracking-tight text-[#b16f75]">
                {formatBRL(gift.price)}
              </p>

              <p className="mt-1 break-words text-xs leading-relaxed text-[#968986]">
                {gift.priceSource === 'auto'
                  ? 'Preço obtido automaticamente'
                  : 'Preço informado por você'}

                {gift.reservedAmount > 0 &&
                  ` · ${formatBRL(gift.reservedAmount)} já reservado em cotas`}
              </p>

              {gift.purchasedViaLinkBy && gift.purchasedViaLinkAt && (
                <p className="mt-1 break-words text-xs font-medium leading-relaxed text-[#9d646a]">
                  {/* Fuso fixo: o mesmo texto sai no servidor e no navegador (sem erro de hidratação). */}
                  Comprado pelo link por {gift.purchasedViaLinkBy} em{' '}
                  {new Date(gift.purchasedViaLinkAt).toLocaleDateString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                  })}
                </p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-[#eee1df] pt-3">
                {gift.productUrl && (
                  <a
                    href={gift.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#a96c72] transition hover:bg-[#fff0f1] hover:text-[#8f555b]"
                  >
                    <ExternalLink size={15} />
                    Ver na loja
                  </a>
                )}

                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#796966] transition hover:bg-[#f8eeee] hover:text-[#9d646a]"
                >
                  <Pencil size={15} />
                  Editar presente
                </button>
              </div>
            </div>

          </div>
        </div>
        {showDeleteConfirmation && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center
               rounded-2xl bg-[#302b28]/45 p-3 backdrop-blur-sm
               animate-in fade-in duration-200 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-title-${gift.id}`}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/80
                 bg-[#fffaf9]/95 p-5 shadow-2xl backdrop-blur-xl
                 sm:p-6"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center
                      rounded-2xl border border-red-100 bg-red-50
                      text-red-500">
                <Trash2 size={23} strokeWidth={1.8} />
              </div>

              <h3
                id={`delete-title-${gift.id}`}
                className="mt-4 text-center font-serif text-xl text-[#302b28]"
              >
                Excluir presente?
              </h3>

              <p className="mt-2 break-words text-center text-sm leading-relaxed text-[#827573]">
                Tem certeza de que deseja excluir{' '}
                <span className="font-semibold text-[#514543]">
                  {gift.title}
                </span>
                ? Essa ação pode ser permanente.
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmation(false)}
                  disabled={isDeleting}
                  className="order-2 inline-flex min-h-11 flex-1 items-center
                     justify-center gap-2 rounded-xl border
                     border-[#e8d8d8] bg-white px-4 py-2.5
                     text-sm font-semibold text-[#796966]
                     transition hover:bg-[#fff0f1]
                     disabled:opacity-50 sm:order-1"
                >
                  <X size={16} />
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="order-1 inline-flex min-h-11 flex-1 items-center
                     justify-center gap-2 rounded-xl bg-red-500
                     px-4 py-2.5 text-sm font-semibold text-white
                     shadow-sm transition hover:bg-red-600
                     disabled:cursor-not-allowed disabled:opacity-60
                     sm:order-2"
                >
                  {isDeleting ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Sim, excluir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </li>
      {isEditing &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#302b28]/45 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:p-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !isSaving && !isDeleting) {
                cancelEditing();
                setShowDeleteConfirmation(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby={`edit-title-${gift.id}`}
              className="my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-white/80 bg-[#fffaf9] shadow-[0_25px_100px_rgba(48,43,40,0.25)] animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
            >
              <header className="flex items-center gap-3 border-b border-[#eee1df] px-5 py-5 sm:px-7">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0f1] text-[#b47b7f]">
                  <GiftIcon size={25} />
                </div>

                <div className="min-w-0 flex-1">
                  <h2
                    id={`edit-title-${gift.id}`}
                    className="font-serif text-xl text-[#302b28] sm:text-2xl"
                  >
                    Editar presente
                  </h2>
                  <p className="mt-1 text-sm text-[#827573]">
                    Atualize as informações do presente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving || isDeleting}
                  aria-label="Fechar edição"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#827573] transition hover:bg-[#fff0f1] hover:text-[#9d646a] disabled:opacity-50"
                >
                  <X size={21} />
                </button>
              </header>

              <div className="max-h-[calc(100dvh-150px)] overflow-y-auto p-5 sm:p-7">
                <form onSubmit={handleSave} className="flex flex-col gap-5">
                  <div>
                    <label
                      htmlFor={`gift-title-${gift.id}`}
                      className="mb-2 block text-sm font-semibold text-[#6e5c59]"
                    >
                      Nome do presente
                    </label>
                    <input
                      id={`gift-title-${gift.id}`}
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={160}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`gift-price-${gift.id}`}
                      className="mb-2 block text-sm font-semibold text-[#6e5c59]"
                    >
                      Preço (R$)
                    </label>
                    <input
                      id={`gift-price-${gift.id}`}
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      disabled={!canEditPrice}
                      className={inputClass}
                    />

                    {!canEditPrice && (
                      <p className="mt-2 text-xs leading-relaxed text-[#968986]">
                        O preço não pode mais ser alterado nesta etapa.
                      </p>
                    )}
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
                    >
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {showDeleteConfirmation ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4">
                      <h3 className="font-semibold text-red-800">
                        Excluir este presente?
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-red-700">
                        Deseja realmente excluir “{gift.title}”? Essa ação pode ser
                        permanente.
                      </p>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isDeleting || isSaving}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <LoaderCircle size={17} className="animate-spin" />
                          ) : (
                            <Trash2 size={17} />
                          )}
                          {isDeleting ? 'Excluindo...' : 'Sim, excluir'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirmation(false)}
                          disabled={isDeleting}
                          className="min-h-11 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Manter presente
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 border-t border-[#eee1df] pt-5 sm:flex-row sm:flex-wrap">
                      <button
                        type="submit"
                        disabled={isSaving || isDeleting}
                        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? (
                          <>
                            <LoaderCircle size={17} className="animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save size={17} />
                            Salvar alterações
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={isSaving || isDeleting}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#e8d8d8] bg-white px-5 py-3 text-sm font-medium text-[#796966] transition hover:bg-[#fff1f2] disabled:opacity-50"
                      >
                        <X size={17} />
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirmation(true)}
                        disabled={isSaving || isDeleting}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 sm:mt-1"
                      >
                        <Trash2 size={17} />
                        Excluir presente
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

export default function GiftList({
  slug,
  gifts,
  loadFailed,
}: {
  slug: string;
  gifts: Gift[];
  loadFailed: boolean;
}) {
  return (
    <section className="relative z-0 w-full min-w-0 rounded-[24px] border border-white/70 bg-white/60 p-4 shadow-[0_20px_60px_rgba(115,77,77,0.08)] backdrop-blur-2xl sm:rounded-[28px] sm:p-6 md:p-7">
      {/* Brilho decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#e8caca]/25 blur-3xl"
      />

      <div className="relative flex min-w-0 items-start gap-3 border-b border-[#e9dada]/80 pb-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e8caca]/60 bg-[#fff0f1] text-[#b47b7f] sm:h-12 sm:w-12">
          <GiftIcon size={23} strokeWidth={1.7} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl text-[#302b28] sm:text-3xl">
            Meus presentes
          </h2>

          <p className="mt-1 text-sm leading-relaxed text-[#827573]">
            Gerencie os presentes da sua lista e acompanhe os valores.
          </p>
        </div>

        {!loadFailed && gifts.length > 0 && (
          <span className="shrink-0 rounded-full border border-[#e8caca]/60 bg-[#fff0f1] px-3 py-1 text-xs font-semibold text-[#9d646a] sm:text-sm">
            {gifts.length} {gifts.length === 1 ? 'presente' : 'presentes'}
          </span>
        )}
      </div>

      <div className="relative mt-5">
        {loadFailed ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm leading-relaxed text-amber-800"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Não foi possível carregar os presentes.</p>
              <p className="mt-1">
                Atualize a página em instantes para tentar novamente.
              </p>
            </div>
          </div>
        ) : gifts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dfbfc1] bg-white/40 px-4 py-8 text-center sm:px-6 sm:py-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0f1] text-[#b47b7f]">
              <ShoppingBag size={27} strokeWidth={1.5} />
            </div>

            <h3 className="mt-4 font-serif text-xl text-[#302b28]">
              Sua lista está esperando presentes
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#827573]">
              Você ainda não cadastrou nenhum presente. Adicione o link de um
              produto acima para começar a montar sua lista.
            </p>
          </div>
        ) : (
          <ul className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {gifts.map((gift) => (
              <GiftCard key={gift.id} slug={slug} gift={gift} />
            ))}
          </ul>
        )}
      </div>

      {!loadFailed && gifts.length > 0 && (
        <div className="relative mt-4 flex items-center gap-2 text-xs leading-relaxed text-[#968986]">
          <CheckCircle2 size={15} className="shrink-0 text-[#b47b7f]" />
          <p>As alterações são atualizadas na lista após serem salvas.</p>
        </div>
      )}
    </section>
  );
}