import Link from "next/link";

export default async function CasamentoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Por enquanto estamos usando dados fictícios.
  // Depois vamos buscar essas informações no backend.
  const casamento = {
    noivos: "Paulo & Denise",
    data: "15 de Novembro de 2026",
    cidade: "Campo Mourão - PR",
    mensagem:
      "Estamos muito felizes em compartilhar este momento tão especial com vocês!",
    foto:
      "https://cdn-assets-legacy.casar.com/thumb/autoxautox1xx0,0,1280,576/dados/sitenoivos/wed1500392/sliders/B7ViA_1781837730.jpeg",
  };

  const presentes = [
    {
      id: 1,
      nome: "Cafeteira",
      descricao: "Para começarmos nossas manhãs juntos.",
      preco: 450,
      imagem:
        "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: 2,
      nome: "Jantar romântico",
      descricao: "Uma noite especial para nós dois.",
      preco: 200,
      imagem:
        "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: 3,
      nome: "Passeio na lua de mel",
      descricao: "Uma experiência inesquecível durante nossa viagem.",
      preco: 300,
      imagem:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: 4,
      nome: "Hospedagem",
      descricao: "Uma diária para tornar nossa viagem ainda mais especial.",
      preco: 350,
      imagem:
        "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=600&q=80",
    },
  ];

  return (
    <main className="min-h-screen bg-[#fff9fb] text-gray-800">
      {/* HERO */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        <img
          src={casamento.foto}
          alt={`Foto de ${casamento.noivos}`}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 flex h-full items-center justify-center px-6 text-center text-white">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm uppercase tracking-[0.35em]">
              Nosso casamento
            </p>

            <h1 className="text-5xl font-semibold md:text-7xl">
              {casamento.noivos}
            </h1>

            <p className="mt-6 text-xl md:text-2xl">{casamento.data}</p>

            <p className="mt-2 text-base md:text-lg">
              {casamento.cidade}
            </p>
          </div>
        </div>
      </section>

      {/* MENSAGEM */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-4xl">💍</span>

          <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
            Um momento especial
          </h2>

          <p className="mt-6 text-lg leading-8 text-gray-600">
            {casamento.mensagem}
          </p>
        </div>
      </section>

      {/* PRESENTES */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-pink-500">
              Lista de presentes
            </p>

            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
              Escolha um presente para o casal 🎁
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              Cada presente representa uma contribuição para começarmos essa
              nova etapa da nossa vida juntos.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {presentes.map((presente) => (
              <div
                key={presente.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <img
                  src={presente.imagem}
                  alt={presente.nome}
                  className="h-52 w-full object-cover"
                />

                <div className="p-5">
                  <h3 className="text-xl font-semibold">
                    {presente.nome}
                  </h3>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-gray-500">
                    {presente.descricao}
                  </p>

                  <p className="mt-5 text-2xl font-bold text-pink-500">
                    R$ {presente.preco.toFixed(2).replace(".", ",")}
                  </p>

                  <Link
                    href={`/checkout?casamento=${slug}&presente=${presente.id}`}
                    className="mt-5 block w-full rounded-xl bg-pink-500 px-4 py-3 text-center font-semibold text-white transition hover:bg-pink-600"
                  >
                    Presentear
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MENSAGEM FINAL */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold">
            Obrigado por fazer parte da nossa história ❤️
          </h2>

          <p className="mt-5 text-gray-500">
            Sua presença e seu carinho tornam esse momento ainda mais
            especial.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
        <p>
          GiftCasamento · Página de casamento de{" "}
          <span className="font-semibold">{casamento.noivos}</span>
        </p>
      </footer>
    </main>
  );
}
