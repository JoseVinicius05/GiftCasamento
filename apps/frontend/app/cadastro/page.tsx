'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!acceptedTerms) {
      setError('Você precisa concordar com os termos de uso.');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(message ?? 'Não foi possível criar sua conta.');
        return;
      }

      router.push('/login');
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-pink-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Criar sua conta
          </h1>

          <p className="text-gray-500 mt-2">
            Comece a criar sua lista de casamento
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Nome */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Nome
            </label>

            <input
              id="name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          {/* E-mail */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              E-mail
            </label>

            <input
              id="email"
              type="email"
              placeholder="seuemail@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          {/* Senha */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Senha
            </label>

            <input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          {/* Confirmar senha */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Confirmar senha
            </label>

            <input
              id="confirmPassword"
              type="password"
              placeholder="Digite a senha novamente"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          {/* Termos */}
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <input
              id="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
            />

            <label htmlFor="terms">
              Li e concordo com os termos de uso e política de privacidade.
            </label>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white
                       font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Criando conta...' : 'Criar minha conta'}
          </button>

        </form>

        <div className="text-center mt-6">
          <p className="text-gray-500">
            Já possui uma conta?
          </p>

          <a
            href="/login"
            className="text-pink-500 font-semibold hover:underline"
          >
            Entrar
          </a>
        </div>

      </div>
    </main>
  );
}
