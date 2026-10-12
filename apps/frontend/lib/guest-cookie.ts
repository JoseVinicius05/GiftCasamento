// Cookie httpOnly da sessão do CONVIDADO. Um cookie POR EVENTO (o slug entra
// no nome): quem é convidado de dois casamentos não mistura as sessões, e a
// senha de um evento nunca libera o outro. Fica separado do cookie de login
// do dono (auth-cookie.ts) — são mundos diferentes.
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias — mesmo prazo do token no backend

export function guestCookieName(slug: string): string {
  return `gift_guest_${slug}`;
}
