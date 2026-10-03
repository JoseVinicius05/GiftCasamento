import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '../../../../lib/auth-cookie';

// Proxy (BFF) pro PATCH /events/:slug do backend — mesmo motivo do
// app/api/events/route.ts: o formulário de edição é um Client Component,
// sem acesso ao cookie httpOnly.
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Você precisa estar logado.' }, { status: 401 });
  }

  const body = await request.json();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const backendResponse = await fetch(`${apiUrl}/events/${slug}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await backendResponse.json();
  return NextResponse.json(data, { status: backendResponse.status });
}
