import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { guestCookieName } from '../../../../../../../lib/guest-cookie';

// Proxy (BFF) da reserva de cota do CONVIDADO. O token de sessão está num
// cookie httpOnly, então só o servidor do Next consegue lê-lo e repassá-lo
// ao backend como Bearer — o navegador nunca vê o token.
//
// POST /api/events/:slug/gifts/:giftId/contributions  { amount }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; giftId: string }> },
) {
  const { slug, giftId } = await params;

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
      `${process.env.NEXT_PUBLIC_API_URL}/events/${encodeURIComponent(slug)}/guest/gifts/${encodeURIComponent(giftId)}/contributions`,
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
    return NextResponse.json(
      { message: 'Não foi possível falar com o servidor agora.' },
      { status: 502 },
    );
  }

  // Repassa status e corpo como vieram (201 com os dados de pagamento; 400/409
  // com { message, code, ... }; 401 de sessão vencida; 429 de rate limit): o
  // modal decide o que mostrar a partir deles.
  const data = await backendResponse.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendResponse.status });
}
