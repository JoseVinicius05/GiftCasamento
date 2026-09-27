"use client";

import { useState } from "react";

function gerarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CriarCasamentoPage() {
  const [nome1, setNome1] = useState("");
  const [nome2, setNome2] = useState("");
  const [slug, setSlug] = useState("");

  function atualizarSlug(nome1Novo: string, nome2Novo: string) {
    const nomes = `${nome1Novo} e ${nome2Novo}`.trim();
    setSlug(gerarSlug(nomes));
  }

  function handleNome1Change(valor: string) {
    setNome1(valor);
    atualizarSlug(valor, nome2);
  }

  function handleNome2Change(valor: string) {
    setNome2(valor);
    atualizarSlug(nome1, valor);
  }

  return (
    <main className="min-h-screen bg-[#fff8fb] px-4 py-10">
      <div className="mx-auto max-w-3xl">

        {/* Cabeçalho */}
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-pink-500">
            GiftCasamento
          </p>

          <h1 className="mt-3 text-4xl font-bold text-gray-800">
            Crie sua página de casamento
          </h1>

          <p className="mt-3 text-gray-500">
            Preencha os dados abaixo. Você poderá alterar tudo depois.
          </p>
        </div>

        {/* Formulário */}
        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-10">

          <form className="space-y-7">

            {/* Nomes */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-gray-700">
                Nomes dos noivos
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <input
                    type="text"
                    value={nome1}
                    onChange={(e) => handleNome1Change(e.target.value)}
                    placeholder="Primeiro nome"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={nome2}
                    onChange={(e) => handleNome2Change(e.target.value)}
                    placeholder="Segundo nome"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* Data */}
            <div>
              <label
                htmlFor="date"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Data do casamento
              </label>

              <input
                id="date"
                type="date"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
              />
            </div>

            {/* Cidade */}
            <div>
              <label
                htmlFor="city"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Cidade
              </label>

              <input
                id="city"
                type="text"
                placeholder="Ex.: Campo Mourão - PR"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
              />
            </div>

            {/* Mensagem */}
            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Mensagem para os convidados
              </label>

              <textarea
                id="message"
                rows={5}
                placeholder="Ex.: Estamos muito felizes em compartilhar esse momento com vocês!"
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
              />
            </div>

            {/* Foto */}
            <div>
              <label
                htmlFor="photo"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Foto do casal
              </label>

              <input
                id="photo"
                type="file"
                accept="image/*"
                className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-600"
              />

              <p className="mt-2 text-xs text-gray-400">
                JPG, PNG ou WEBP.
              </p>
            </div>

            {/* Slug */}
            <div>
              <label
                htmlFor="slug"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Endereço da sua página
              </label>

              <div className="flex flex-col overflow-hidden rounded-xl border border-gray-300 md:flex-row">
                <div className="bg-gray-100 px-4 py-3 text-sm text-gray-500 md:whitespace-nowrap">
                  giftcasamento.com/casamento/
                </div>

                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(gerarSlug(e.target.value))}
                  placeholder="jose-e-maria"
                  className="min-w-0 flex-1 px-4 py-3 outline-none text-gray-800"
                />
              </div>

              <p className="mt-2 text-xs text-gray-400">
                Esse será o link que você compartilhará com seus convidados.
              </p>
            </div>

            {/* Preview */}
            <div className="rounded-2xl bg-pink-50 p-5">
              <p className="text-sm font-semibold text-pink-600">
                Seu endereço ficará assim:
              </p>

              <p className="mt-2 break-all font-medium text-gray-700 text-gray-800">
                https://giftcasamento.com/casamento/
                {slug || "jose-e-maria"}
              </p>
            </div>

            {/* Botão */}
            <button
              type="submit"
              className="w-full rounded-xl bg-pink-500 px-6 py-4 font-semibold text-white transition hover:bg-pink-600"
            >
              Criar meu casamento
            </button>
          </form>
        </section>

        {/* Rodapé */}
        <p className="mt-6 text-center text-sm text-gray-400">
          Você poderá editar essas informações depois.
        </p>
      </div>
    </main>
  );
}
