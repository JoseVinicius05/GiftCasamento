// Tipos e textos da página pública do convidado (resposta de
// GET /events/:slug/guest/overview do backend).
import type { GiftStatus } from './gifts';

export type GuestGift = {
  id: string;
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
  price: number;
  status: GiftStatus;
  // Soma das cotas confirmadas + pendentes ainda válidas.
  reservedAmount: number;
  // price - reservedAmount (nunca negativo): quanto ainda dá pra contribuir.
  availableAmount: number;
};

export type GuestEventType =
  | 'casamento'
  | 'aniversario'
  | 'cha_de_bebe'
  | 'cha_de_cozinha'
  | 'outro';

export type GuestOverview = {
  event: {
    slug: string;
    title: string;
    eventType: GuestEventType;
    eventDate: string;
  };
  guest: { name: string };
  gifts: GuestGift[];
};

export const GUEST_EVENT_KICKER: Record<GuestEventType, string> = {
  casamento: 'Nosso casamento',
  aniversario: 'Meu aniversário',
  cha_de_bebe: 'Chá de bebê',
  cha_de_cozinha: 'Chá de cozinha',
  outro: 'Você está convidado',
};

// Presente que ninguém mais pode escolher (já foi pago por completo, comprado
// ou entregue). Os outros estados ainda aceitam contribuição.
export function isGiftClosed(status: GiftStatus): boolean {
  return status === 'fully_funded' || status === 'purchased_via_link' || status === 'confirmed';
}
