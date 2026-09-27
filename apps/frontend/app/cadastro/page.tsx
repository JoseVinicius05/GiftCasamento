export default function CadastroPage() {
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

        <form className="space-y-5">

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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg
                         outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          {/* Termos */}
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <input
              id="terms"
              type="checkbox"
              className="mt-1"
            />

            <label htmlFor="terms">
              Li e concordo com os termos de uso e política de privacidade.
            </label>
          </div>

          {/* Botão */}
          <button
            type="submit"
            className="w-full bg-pink-500 hover:bg-pink-600 text-white
                       font-semibold py-3 rounded-lg transition"
          >
            Criar minha conta
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
