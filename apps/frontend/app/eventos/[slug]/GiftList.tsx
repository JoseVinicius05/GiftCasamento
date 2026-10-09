'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  firstApiMessage,
  formatBRL,
  GIFT_STATUS_LABEL,
  parsePriceInput,
  PRICE_EDITABLE_STATUSES,
  type Gift,
} from '../../../lib/gifts';

// Lista dos presentes do evento (visão do DONO). Cada card pode ser editado
// ali mesmo (nome e preço). Depois de salvar, router.refresh() faz o servidor
// buscar a lista de novo — a página é um Server Component.

function GiftCard({ slug, gift }: { slug: string; gift: Gift }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(gift.title);
  const [price, setPrice] = useState(String(gift.price).replace('.', ','));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEditPrice = PRICE_EDITABLE_STATUSES.includes(gift.status);

  function startEditing() {
    setTitle(gift.title);
    setPrice(String(gift.price).replace('.', ','));
    setError(null);
    setIsEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('O nome do presente não pode ficar vazio.');
      return;
    }

    const body: { title?: string; price?: number } = {};
    if (trimmedTitle !== gift.title) body.title = trimmedTitle;

    if (canEditPrice) {
      const parsed = parsePriceInput(price);
      if (parsed === null) {
        setError('Informe um preço válido, por exemplo 249,90.');
        return;
      }
      if (parsed !== gift.price) body.price = parsed;
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

      if (response.status === 401) setError('Sua sessão expirou. Entre de novo para continuar.');
      else if (response.status === 404) setError('Esse presente não existe mais.');
      else setError(firstApiMessage(data, 'Não foi possível salvar agora. Tente de novo.'));
    } catch {
      setError('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <li className="rounded-xl border border-pink-100 bg-white p-4">
      <div className="flex gap-4">
        {gift.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gift.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-pink-50 text-xs text-gray-400">
            sem imagem
          </div>
        )}

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <form onSubmit={handleSave} className="flex flex-col gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Nome do presente"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-pink-400"
              />
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={!canEditPrice}
                aria-label="Preço"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-pink-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {!canEditPrice && (
                <p className="text-xs text-gray-400">
                  O preço não pode mais ser alterado neste estágio.
                </p>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-pink-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-800">{gift.title}</h3>
                <span className="shrink-0 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700">
                  {GIFT_STATUS_LABEL[gift.status]}
                </span>
              </div>

              <p className="mt-1 text-lg font-bold text-gray-800">{formatBRL(gift.price)}</p>
              <p className="text-xs text-gray-400">
                {gift.priceSource === 'auto' ? 'Preço obtido automaticamente' : 'Preço informado por você'}
                {gift.reservedAmount > 0 && ` · ${formatBRL(gift.reservedAmount)} já reservado em cotas`}
              </p>

              <div className="mt-2 flex items-center gap-4 text-sm">
                {gift.productUrl && (
                  <a
                    href={gift.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-pink-600 hover:underline"
                  >
                    Ver na loja
                  </a>
                )}
                <button
                  type="button"
                  onClick={startEditing}
                  className="font-medium text-gray-500 hover:underline"
                >
                  Editar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
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
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-800">
        Presentes do evento{!loadFailed && gifts.length > 0 && ` (${gifts.length})`}
      </h2>

      {loadFailed ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Não foi possível carregar a lista de presentes agora. Atualize a página em instantes.
        </p>
      ) : gifts.length === 0 ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-pink-200 px-4 py-6 text-center text-sm text-gray-500">
          Nenhum presente cadastrado ainda. Cole o link de um produto acima para começar.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {gifts.map((gift) => (
            <GiftCard key={gift.id} slug={slug} gift={gift} />
          ))}
        </ul>
      )}
    </div>
  );
}
