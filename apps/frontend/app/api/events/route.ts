import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '../../../lib/auth-cookie';

// Proxy (BFF) pro POST /events do backend. Existe porque o formulário de
// criar evento é um Client Component — ele não tem acesso ao cookie httpOnly
// (de propósito, ver app/api/login/route.ts), então não consegue montar o
// header Authorization sozinho. Esta rota roda no servidor do Next, lê o
// cookie, e repassa o token pro backend.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: 'Você precisa estar logado.' }, { status: 401 });
  }

  const body = await request.json();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const backendResponse = await fetch(`${apiUrl}/events`, {
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
