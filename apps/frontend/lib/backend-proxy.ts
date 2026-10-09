import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from './auth-cookie';

// Repassa uma chamada do navegador pro backend Nest, anexando o token do
// cookie httpOnly (que o JavaScript do navegador não consegue ler). É o mesmo
// padrão das outras rotas /api/events — só que num lugar só, pra as rotas de
// presentes não repetirem o mesmo bloco.
//
// O status e o corpo do backend passam direto pro navegador, porque os
// formulários dependem deles (400 com a lista de erros, 404, 409 com a
// mensagem de preço, 422 com o "code" etc).
export async function proxyToBackend(
  path: string,
  options: { method: 'GET' | 'POST' | 'PATCH'; body?: unknown },
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Você precisa estar logado.' }, { status: 401 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
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
