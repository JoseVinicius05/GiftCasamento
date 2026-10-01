import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '../../../lib/auth-cookie';

export async function POST(request: Request) {
  const body = await request.json();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const backendResponse = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await backendResponse.json();

  // Credenciais erradas ou erro de validação: repassa a resposta do backend como está.
  if (!backendResponse.ok) {
    return NextResponse.json(data, { status: backendResponse.status });
  }

  // Sucesso: devolve só os dados do usuário pro client, e o token vai num
  // cookie httpOnly — o JavaScript da página nunca chega a ver o JWT.
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(TOKEN_COOKIE, data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias — mesmo prazo do token no backend
  });

  return response;
}
