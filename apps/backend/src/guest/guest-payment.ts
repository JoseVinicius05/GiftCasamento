import { buildPixPayload } from '../pix/pix-payload';

// Dados de pagamento Pix de uma cota: a chave do dono e o Copia e Cola com o
// valor. Um lugar só, usado na criação da cota e ao reabrir o pagamento de uma
// cota pendente — assim o QR é sempre gerado do mesmo jeito (inclusive o
// `txid` = id da cota, que o dono usará pra conciliar na Sprint 5).
//
// `pixPayload` é null quando a chave do dono não pode virar um BR Code válido;
// a tela mostra só a chave, sem QR.
export function buildGuestPayment(
  event: { pixKey: string; owner: { name: string } },
  contribution: { id: string; amount: unknown },
) {
  return {
    pixKey: event.pixKey,
    pixPayload: buildPixPayload({
      key: event.pixKey,
      amount: Number(contribution.amount),
      merchantName: event.owner.name,
      txid: contribution.id,
    }),
  };
}
