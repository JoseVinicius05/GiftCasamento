import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TOKEN_COOKIE } from '../../lib/auth-cookie';
import LogoutButton from './LogoutButton';

// Página de teste do Dia 3: só existe pra provar que login + JWT + rota
// protegida (/auth/me) funcionam de ponta a ponta. A proteção "de verdade"
// via middleware, cobrindo várias rotas, é passo do Dia 4.
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;

  if (!token) {
    redirect('/login');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    redirect('/login');
  }

  const user: { name: string; email: string } = await response.json();

  return (
    <main className="min-h-screen bg-pink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Olá, {user.name}!</h1>
        <p className="text-gray-500 mt-2">{user.email}</p>
        <p className="text-sm text-gray-400 mt-6">
          Esta página confirma que cadastro → login → /auth/me estão funcionando.
        </p>
        <Link
          href="/meus-eventos"
          className="mt-4 block font-semibold text-pink-500 hover:underline"
        >
          Ver meus eventos
        </Link>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
