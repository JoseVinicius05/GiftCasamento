import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '../../../../../../lib/auth-cookie';

// Proxy (BFF) pro POST /events/:slug/gifts/preview do backend — mesmo padrão
// de /api/events e /api/events/[slug]: lê o cookie httpOnly aqui no servidor
// do Next e repassa o token pro backend via header Authorization.
//
// O status e o corpo do backend passam direto pro navegador, porque o
// formulário depende deles: 422 com { code: 'UNSUPPORTED_ECOMMERCE' } (loja
// fora do escopo do MVP), 404 (evento não é do usuário), 429 (rate limit).
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Você precisa estar logado.' }, { status: 401 });
  }

  const body = await request.json();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${apiUrl}/events/${slug}/gifts/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Backend fora do ar / acordando (Render free tier dorme): devolve um
    // erro legível em vez de deixar a rota estourar com 500.
    return NextResponse.json(
      { message: 'Não foi possível falar com o servidor agora.' },
      { status: 502 },
    );
  }

  const data = await backendResponse.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendResponse.status });
}
