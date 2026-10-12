import { NextResponse } from 'next/server';
import { GUEST_COOKIE_MAX_AGE, guestCookieName } from '../../../../../lib/guest-cookie';

// Proxy (BFF) do acesso do CONVIDADO. É pública (convidado não tem conta),
// mas continua passando pelo servidor do Next por um motivo: o token de
// sessão que o backend devolve precisa ir pra um cookie httpOnly — o
// JavaScript da página nunca chega a ver o token.

// POST /api/events/:slug/access  { password, name } → confere a senha no
// backend e, se estiver certa, grava o cookie da sessão deste evento.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Requisição inválida.' }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/events/${encodeURIComponent(slug)}/access`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    );
  } catch {
    // Backend fora do ar / acordando (Render free tier dorme).
    return NextResponse.json(
      { message: 'Não foi possível falar com o servidor agora.' },
      { status: 502 },
    );
  }

  const data = await backendResponse.json().catch(() => ({}));

  // Senha errada (401), evento inexistente (404), validação (400), rate
  // limit (429): repassa status e corpo como estão — o formulário depende deles.
  if (!backendResponse.ok || typeof data.accessToken !== 'string') {
    const status = backendResponse.ok ? 502 : backendResponse.status;
    return NextResponse.json(data, { status });
  }

  // O token NÃO vai no corpo da resposta, só no cookie.
  const response = NextResponse.json({ guest: data.guest, event: data.event });
  response.cookies.set(guestCookieName(slug), data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  });

  return response;
}

// DELETE /api/events/:slug/access → "não sou eu / sair": apaga a sessão.
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(guestCookieName(slug));
  return response;
}
