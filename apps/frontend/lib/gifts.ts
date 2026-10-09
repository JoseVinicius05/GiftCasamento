// Tipos e helpers de presentes, compartilhados entre a lista e o formulário.

export type GiftStatus =
  | 'available'
  | 'partially_funded'
  | 'fully_funded'
  | 'purchased_via_link'
  | 'confirmed';

export type Gift = {
  id: string;
  productUrl: string | null;
  title: string;
  imageUrl: string | null;
  price: number;
  priceSource: 'auto' | 'manual';
  status: GiftStatus;
  createdAt: string;
  // Soma das cotas confirmadas + pendentes ainda válidas (hoje sempre 0).
  reservedAmount: number;
};

export const GIFT_STATUS_LABEL: Record<GiftStatus, string> = {
  available: 'Disponível',
  partially_funded: 'Cotas em andamento',
  fully_funded: 'Valor completo',
  purchased_via_link: 'Comprado pelo link',
  confirmed: 'Entregue',
};

// Só enquanto o presente está "aberto" o preço pode mudar (mesma regra do backend).
export const PRICE_EDITABLE_STATUSES: GiftStatus[] = ['available', 'partially_funded'];

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Converte o que o dono digita ("249,90", "1.299,90", "R$ 80", "80.5") em
// número. Devolve null se não for um valor válido (vazio, zero, negativo,
// mais de 2 casas decimais, ou texto).
export function parsePriceInput(input: string): number | null {
  let text = input.replace(/R\$/gi, '').replace(/\s/g, '');
  if (text === '') return null;

  if (text.includes(',')) {
    // pt-BR: ponto separa milhar, vírgula separa centavos.
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.299" sem vírgula: milhar (R$ 1299), não 1,299.
    text = text.replace(/\./g, '');
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  // No máximo 2 casas decimais.
  if (Math.round(value * 100) / 100 !== value) return null;
  return value;
}

// O backend (class-validator) devolve { message: string[] } em 400; as nossas
// próprias exceções devolvem { message: string }.
export function firstApiMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message ?? fallback;
}
