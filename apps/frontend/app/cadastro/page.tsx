"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function CadastroPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [pageReady, setPageReady] = useState(false);

  // =========================================
  // ANIMAÇÃO DE ENTRADA
  // =========================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setPageReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // =========================================
  // CADASTRO
  // =========================================

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (!acceptedTerms) {
      setError(
        "Você precisa concordar com os termos de uso."
      );
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const response = await fetch(
        `${apiUrl}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message[0]
          : data.message;

        setError(
          message ?? "Não foi possível criar sua conta."
        );

        return;
      }

      router.push("/login");
    } catch {
      setError(
        "Não foi possível conectar ao servidor. Tente novamente em instantes."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-8 sm:px-6">

      {/* ========================================= */}
      {/* BACKGROUND */}
      {/* ========================================= */}

      <div
        className="absolute inset-0 bg-[#fff7f8] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/background.png')",
        }}
      />

      {/* Camada rosada */}
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
          ${
            pageReady
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
          ${
            pageReady
              ? "scale-100 opacity-100"
              : "scale-50 opacity-0"
          }
        `}
      />

      {/* ========================================= */}
      {/* CARD */}
      {/* ========================================= */}

      <div
        className={`
          relative
          z-10
          w-full
          max-w-md
          rounded-[28px]
          border
          border-black/5
          bg-white/10
          p-6
          shadow-2xl
          backdrop-blur-xl
          transition-all
          duration-700
          sm:p-8
          ${
            pageReady
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-4 scale-[0.98] opacity-0"
          }
        `}
      >

        {/* ========================================= */}
        {/* LOGO */}
        {/* ========================================= */}

        <div className="mb-8 text-center">

          <h1 className="font-serif text-5xl tracking-tight text-[#302b28]">
            Web
            <span className="italic text-[#b47b7f]">
              Gift
            </span>
          </h1>

          <p className="mt-2 text-gray-500">
            Crie sua conta
          </p>

        </div>

        {/* ========================================= */}
        {/* FORMULÁRIO */}
        {/* ========================================= */}

        <form
          className="space-y-5"
          onSubmit={handleSubmit}
        >

          {/* ======================================= */}
          {/* ERRO */}
          {/* ======================================= */}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* ======================================= */}
          {/* NOME */}
          {/* ======================================= */}

          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Nome
            </label>

            <input
              id="name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required
              autoComplete="name"
              className="
                w-full
                rounded-xl
                border
                border-gray-300
                bg-white/80
                px-4
                py-3
                text-black
                outline-none
                transition
                placeholder:text-gray-400
                focus:border-pink-400
                focus:ring-2
                focus:ring-pink-200
              "
            />
          </div>

          {/* ======================================= */}
          {/* E-MAIL */}
          {/* ======================================= */}

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
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              autoComplete="email"
              className="
                w-full
                rounded-xl
                border
                border-gray-300
                bg-white/80
                px-4
                py-3
                text-black
                outline-none
                transition
                placeholder:text-gray-400
                focus:border-pink-400
                focus:ring-2
                focus:ring-pink-200
              "
            />
          </div>

          {/* ======================================= */}
          {/* SENHA */}
          {/* ======================================= */}

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
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                minLength={8}
                autoComplete="new-password"
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-300
                  bg-white/80
                  px-4
                  py-3
                  pr-12
                  text-black
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-pink-400
                  focus:ring-2
                  focus:ring-pink-200
                "
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                  transition
                  hover:text-[#b47b7f]
                "
                aria-label={
                  showPassword
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>

            </div>

            <p className="mt-1.5 text-xs text-gray-400">
              A senha deve possuir pelo menos 8 caracteres.
            </p>
          </div>

          {/* ======================================= */}
          {/* CONFIRMAR SENHA */}
          {/* ======================================= */}

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Confirmar senha
            </label>

            <div className="relative">

              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
                required
                minLength={8}
                autoComplete="new-password"
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-300
                  bg-white/80
                  px-4
                  py-3
                  pr-12
                  text-black
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-pink-400
                  focus:ring-2
                  focus:ring-pink-200
                "
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    !showConfirmPassword
                  )
                }
                className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-gray-400
                  transition
                  hover:text-[#b47b7f]
                "
                aria-label={
                  showConfirmPassword
                    ? "Ocultar senha"
                    : "Mostrar senha"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>

            </div>
          </div>

          {/* ======================================= */}
          {/* TERMOS */}
          {/* ======================================= */}

          <div className="flex items-start gap-3 pt-1 text-sm">

            <input
              id="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) =>
                setAcceptedTerms(
                  e.target.checked
                )
              }
              required
              className="
                mt-1
                h-4
                w-4
                shrink-0
                cursor-pointer
                accent-[#c4777d]
              "
            />

            <label
              htmlFor="terms"
              className="cursor-pointer leading-5 text-gray-600"
            >
              Li e concordo com os{" "}
              <a
                href="#"
                className="font-medium text-[#b47b7f] transition hover:text-[#945d62] hover:underline"
              >
                termos de uso
              </a>{" "}
              e{" "}
              <a
                href="#"
                className="font-medium text-[#b47b7f] transition hover:text-[#945d62] hover:underline"
              >
                política de privacidade
              </a>
              .
            </label>

          </div>

          {/* ======================================= */}
          {/* BOTÃO */}
          {/* ======================================= */}

          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              rounded-xl
              bg-[#c4777d]
              py-3
              font-semibold
              text-white
              shadow-md
              transition-all
              duration-300
              hover:-translate-y-0.5
              hover:bg-[#b66b72]
              hover:shadow-lg
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {loading
              ? "Criando conta..."
              : "Criar minha conta"}
          </button>

        </form>

        {/* ========================================= */}
        {/* LOGIN */}
        {/* ========================================= */}

        <div className="mt-6 text-center">

          <p className="text-gray-500">
            Já possui uma conta?
          </p>

          <a
            href="/login"
            className="
              font-semibold
              text-[#b47b7f]
              transition
              hover:text-[#945d62]
              hover:underline
            "
          >
            Entrar
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
          ${
            pageReady
              ? "opacity-0"
              : "opacity-100"
          }
        `}
      />

    </main>
  );
}