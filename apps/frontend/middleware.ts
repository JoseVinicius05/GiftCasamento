import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE } from './lib/auth-cookie';

// Rotas que exigem estar logado. O dashboard hoje já verifica o cookie
// sozinho (fallback de segurança), mas o middleware é quem barra o acesso
// antes mesmo da página carregar. Conforme novas telas autenticadas forem
// criadas (painel do evento, etc.), é só adicionar o prefixo aqui.
const PROTECTED_PATHS = ['/dashboard'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// O matcher decide em quais requisições o middleware roda — evita rodar em
// toda imagem/asset estático, só nas rotas que interessam.
export const config = {
  matcher: ['/dashboard/:path*'],
};
