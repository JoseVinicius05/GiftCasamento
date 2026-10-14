import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { guestCookieName } from './guest-cookie';

// Repasse das chamadas do convidado ao backend. O token de sessão está num
// cookie httpOnly, então só o servidor do Next consegue lê-lo e mandá-lo como
// Bearer — o navegador nunca vê o token. `backendPath` é o que vem depois de
// /events/:slug (ex.: /guest/gifts/<id>/claim) e já deve vir codificado.
//
// Devolve status e corpo do backend como estão (201/200 com os dados, 400/409
// com { message, code, ... }, 401 de sessão vencida, 429 de rate limit): quem
// chama decide o que mostrar a partir deles.

type GuestMethod = 'GET' | 'POST' | 'DELETE';

async function guestToken(slug: string): Promise<string | undefined> {
  return (await cookies()).get(guestCookieName(slug))?.value;
}

function missingSession() {
  return NextResponse.json({ message: 'Sessão de convidado ausente.' }, { status: 401 });
}

async function send(
  token: string,
  slug: string,
  backendPath: string,
  method: GuestMethod,
  body?: unknown,
) {
  let backendResponse: Response;
  try {
    backendResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/events/${encodeURIComponent(slug)}${backendPath}`,
      {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${token}`,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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

// POST com corpo JSON (reservar cota, presentear).
export async function forwardGuestPost(request: Request, slug: string, backendPath: string) {
  const token = await guestToken(slug);
  if (!token) return missingSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Requisição inválida.' }, { status: 400 });
  }

  return send(token, slug, backendPath, 'POST', body);
}

// GET/DELETE sem corpo (reabrir pagamento, cancelar cota).
export async function forwardGuestRequest(
  slug: string,
  backendPath: string,
  method: Exclude<GuestMethod, 'POST'>,
) {
  const token = await guestToken(slug);
  if (!token) return missingSession();

  return send(token, slug, backendPath, method);
}
