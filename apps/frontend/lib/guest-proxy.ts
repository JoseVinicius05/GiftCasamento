import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { guestCookieName } from './guest-cookie';

// Repassa um POST do convidado ao backend. O token de sessão está num cookie
// httpOnly, então só o servidor do Next consegue lê-lo e mandá-lo como Bearer
// — o navegador nunca vê o token. `backendPath` é o que vem depois de
// /events/:slug (ex.: /guest/gifts/<id>/claim) e já deve vir codificado.
//
// Devolve status e corpo do backend como estão (201 com os dados, 400/409 com
// { message, code, ... }, 401 de sessão vencida, 429 de rate limit): quem
// chama decide o que mostrar a partir deles.
export async function forwardGuestPost(request: Request, slug: string, backendPath: string) {
  const token = (await cookies()).get(guestCookieName(slug))?.value;
  if (!token) {
    return NextResponse.json({ message: 'Sessão de convidado ausente.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Requisição inválida.' }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/events/${encodeURIComponent(slug)}${backendPath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
  return NextResponse.json(data, { status: backendResponse.status });
}
