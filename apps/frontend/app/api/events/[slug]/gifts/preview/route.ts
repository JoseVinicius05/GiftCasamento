import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '../../../../../../lib/auth-cookie';

// Scaffold do Dia 2 (Sprint 3) — mesmo padrão BFF já usado em
// /api/events e /api/events/[slug]: lê o cookie httpOnly aqui no servidor
// do Next e repassa o token pro backend via header Authorization.
//
// O endpoint de destino (POST /events/:slug/gifts/preview) só existe no
// backend a partir do Dia 3 desta sprint — até lá, chamar esta rota
// devolve 404 do próprio backend (e não um erro desta rota). A tela
// "Adicionar presente" continua usando o preview mock até o Dia 3 trocar
// isso pela chamada de verdade.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Você precisa estar logado.' }, { status: 401 });
  }

  const body = await request.json();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const backendResponse = await fetch(`${apiUrl}/events/${slug}/gifts/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await backendResponse.json();
  return NextResponse.json(data, { status: backendResponse.status });
}
