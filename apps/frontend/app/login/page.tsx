"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    // Pequeno atraso para permitir que a animação
    // de entrada seja percebida.
    const timer = setTimeout(() => {
      setPageReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message[0]
          : data.message;

        setError(
          message ?? "E-mail ou senha inválidos."
        );

        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(
        "Não foi possível conectar ao servidor. Tente novamente em instantes."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`relative flex h-dvh w-full items-center justify-center overflow-hidden px-4 ...`}>
      {/* ========================================= */}
      {/* BACKGROUND */}
      {/* ========================================= */}

      <div
        className="absolute inset-0 bg-[#fff7f8] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/background.png')",
        }}
      />

      {/* Camada branca/rosada sobre a imagem */}
      <div className="absolute inset-0 bg-[#fff7f8]/35" />

      {/* Blur suave */}
      <div className="absolute inset-0 backdrop-blur-[1px]" />

      {/* ========================================= */}
      {/* DECORAÇÕES */}
      {/* ========================================= */}

      <div
        className={`
          pointer-events-none
          absolute
          -left-32
          -top-32
          h-96
          w-96
          rounded-full
          bg-[#e8caca]/30
          blur-3xl
          transition-all
          duration-1000
          ${pageReady
            ? "scale-100 opacity-100"
            : "scale-50 opacity-0"
          }
        `}
      />

      <div
        className={`
          pointer-events-none
          absolute
          -bottom-40
          -right-32
          h-96
          w-96
          rounded-full
          bg-[#ead6d6]/40
          blur-3xl
          transition-all
          delay-150
          duration-1000
          ${pageReady
            ? "scale-100 opacity-100"
            : "scale-50 opacity-0"
          }
        `}
      />

      {/* ========================================= */}
      {/* CARD */}
      {/* ========================================= */}

      {/* CARD */}
      <div className="w-full max-w-md rounded-[28px] border border-black/5 bg-white/10 backdrop-blur-xl p-8 shadow-2xl ">

        {/* LOGO */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-5xl tracking-tight text-[#302b28]">
            Web<span className="italic text-[#b47b7f]">Gift</span>
          </h1>

          <p className="mt-2 text-gray-500">
            Entre na sua conta
          </p>
        </div>

        {/* FORMULÁRIO */}
        <form className="space-y-5" onSubmit={handleSubmit}>

          {/* ERRO */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* EMAIL */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-700"
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
              className="w-full rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-black outline-none transition placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
            />
          </div>

          {/* SENHA */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Senha
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-black outline-none transition placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#b47b7f]"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? (<EyeOff className="h-5 w-5" />) : (<Eye className="h-5 w-5" />)}
              </button>
            </div>
          </div>

          {/* BOTÃO */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#c4777d] py-3 font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#b66b72] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* CADASTRO */}
        <div className="mt-6 text-center">
          <p className="text-gray-500">
            Ainda não possui uma conta?
          </p>

          <a
            href="/cadastro"
            className="font-semibold text-[#b47b7f] transition hover:text-[#945d62] hover:underline"
          >
            Criar conta
          </a>
        </div>
      </div>

      {/* ========================================= */}
      {/* ANIMAÇÃO DE ENTRADA */}
      {/* ========================================= */}

      <div
        className={`
          pointer-events-none
          absolute
          inset-0
          z-20
          bg-[#fff7f8]
          transition-opacity
          duration-500
          ${pageReady
            ? "opacity-0"
            : "opacity-100"
          }
        `}
      />
    </main>
  );
}