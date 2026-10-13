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
  // Menor cota aceita agora: R$ 10 ou o restante, se faltar menos que isso.
  // Vem do backend pra a regra existir num lugar só.
  minContribution: number;
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

// Resposta de POST .../gifts/:giftId/contributions (cota reservada).
export type ContributionResult = {
  contribution: {
    id: string;
    giftId: string;
    amount: number;
    status: 'pending' | 'confirmed' | 'expired';
    createdAt: string;
    // A reserva vale até aqui (48h); depois o valor volta a ficar disponível.
    expiresAt: string;
  };
  gift: {
    id: string;
    title: string;
    status: GiftStatus;
    reservedAmount: number;
    availableAmount: number;
  };
  payment: {
    pixKey: string;
    // Pix Copia e Cola já com o valor. null quando a chave do dono não pôde
    // virar um BR Code válido — aí a tela mostra só a chave, sem QR.
    pixPayload: string | null;
  };
};

// Resposta de POST .../gifts/:giftId/claim — depende do método escolhido.
// 'pix': igual à cota (dados de pagamento do valor que faltava).
export type ClaimPixResult = { method: 'pix' } & ContributionResult;

// 'link': o presente foi marcado como comprado pelo link da loja.
export type ClaimLinkResult = {
  method: 'link';
  gift: { id: string; title: string; status: GiftStatus; productUrl: string | null };
};
