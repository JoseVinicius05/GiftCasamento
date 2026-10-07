import Link from "next/link";
import EventPerspectiveCarousel from "@/components/EventPerspectiveCarousel";

const presentes = [
  {
    icon: "✈️",
    title: "Lua de mel",
    description: "Transforme sonhos em experiências inesquecíveis.",
    value: "R$ 300",
  },
  {
    icon: "🍷",
    title: "Jantar romântico",
    description: "Um momento especial para começar a vida a dois.",
    value: "R$ 200",
  },
  {
    icon: "🏡",
    title: "Nossa casa",
    description: "Ajude o casal a construir o novo lar.",
    value: "R$ 450",
  },
];

const etapas = [
  {
    number: "01",
    title: "Crie sua página",
    description:
      "Cadastre os organizadores, a data, uma mensagem e personalize o endereço do evento.",
  },
  {
    number: "02",
    title: "Monte sua lista",
    description:
      "Escolha os presentes, defina os valores e conte aos convidados o que faz sentido para vocês.",
  },
  {
    number: "03",
    title: "Compartilhe",
    description:
      "Envie um único link para seus convidados e deixe tudo organizado em um só lugar.",
  },
  {
    number: "04",
    title: "Receba os presentes",
    description:
      "Os convidados escolhem um presente e realizam o pagamento pelo próprio site.",
  },
];

const faqs = [
  {
    question: "Preciso comprar os produtos da lista?",
    answer:
      "Não. A ideia do WebGift é permitir que o cliente crie presentes simbólicos e receba a contribuição correspondente.",
  },
  {
    question: "Posso personalizar a página do meu evento?",
    answer:
      "Sim. A proposta é permitir personalizar foto, nomes, data, mensagem e a apresentação da lista de presentes.",
  },
  {
    question: "Os convidados precisam criar uma conta?",
    answer:
      "A experiência planejada é simples: o convidado acessa o link do evento, escolhe um presente e segue para o pagamento.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fcfaf8] text-[#262321]">

      {/* NAVBAR */}
      <header className="fixed left-0 right-0 top-0 z-50 px-3 sm:px-4">

        <div className="mx-auto mt-3 flex w-full max-w-7xl items-center justify-between rounded-full border border-black/5 bg-white/80 px-4 py-2.5 shadow-lg shadow-black/5 backdrop-blur-xl sm:mt-4 sm:px-5 sm:py-3 md:px-7">

          <Link
            href="/"
            className="font-serif text-lg tracking-tight text-[#302b28] sm:text-xl"
          >
            Web<span className="italic text-[#b47b7f]">Gift</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-[#66605b] md:flex">

            <a href="#como-funciona" className="transition hover:text-[#302b28]">
              Como funciona
            </a>

            <a href="#presentes" className="transition hover:text-[#302b28]">
              Presentes
            </a>

            <a href="#duvidas" className="transition hover:text-[#302b28]">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-[#5f5954] transition hover:text-[#302b28] sm:block"
            >
              Entrar
            </Link>

            <Link
              href="/login"
              className="
    group relative overflow-hidden
    rounded-full
    bg-[#2d2926]
    px-7 py-4
    text-center
    font-medium text-white
    shadow-lg shadow-black/10
    transition-all duration-300
    hover:-translate-y-1
    hover:bg-[#46403b]
    hover:shadow-xl
    active:scale-95
  "
            >
              <span
                className="
                absolute inset-0
                -translate-x-full
                bg-gradient-to-r
                from-transparent
                via-white/20
                to-transparent
                transition-transform duration-700
                group-hover:translate-x-full"
              />

              <span className="relative flex items-center justify-center gap-2">
                <span className="sm:hidden">✨&nbsp; Criar evento</span>
                <span className="hidden sm:inline">✨&nbsp; Criar meu evento</span>
              </span>
            </Link>
            <details className="relative lg:hidden">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#302b28] shadow-sm [&::-webkit-details-marker]:hidden">
                <span className="text-xl leading-none">☰</span>
              </summary>
              <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-black/5 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
                <a href="#como-funciona" className="block rounded-xl px-4 py-3 text-sm text-[#5f5954] transition hover:bg-[#f8f1ee] hover:text-[#302b28]">Como funciona</a>
                <a href="#presentes" className="block rounded-xl px-4 py-3 text-sm text-[#5f5954] transition hover:bg-[#f8f1ee] hover:text-[#302b28]">Presentes</a>
                <a href="#duvidas" className="block rounded-xl px-4 py-3 text-sm text-[#5f5954] transition hover:bg-[#f8f1ee] hover:text-[#302b28]">Dúvidas</a>
                <Link href="/login" className="mt-1 block rounded-xl bg-[#2d2926] px-4 py-3 text-center text-sm font-medium text-white">Entrar</Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative w-full overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-40">
        <div className="mx-auto grid w-full min-w-0 max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">

          {/* TEXTO */}
          <div className="w-full min-w-0 max-w-2xl">

            <div className="mb-7 inline-flex max-w-full items-center gap-2 rounded-full border border-[#ded4cd] bg-white px-4 py-2 text-sm text-[#766d66]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#b47b7f]" />
              <span>Uma nova forma de presentear</span>
            </div>

            <h1 className="w-full min-w-0 break-words font-serif text-[2.75rem] leading-[0.98] tracking-[-0.04em] text-[#292522] sm:text-6xl lg:text-7xl">
              O presente que
              <span className="block break-words italic text-[#a86f73]">
                faz parte da história.
              </span>
            </h1>

            <p className="mt-7 w-full max-w-xl break-words text-lg leading-8 text-[#6e6761] md:text-xl">
              Crie uma página especial para o seu evento, monte sua lista
              de presentes e compartilhe um único link com todas as pessoas
              que fazem parte desse momento.
            </p>

            <div className="mt-9 flex w-full flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="w-full rounded-full bg-[#2d2926] px-7 py-4 text-center font-medium text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#46403b] sm:w-auto"
              >
                Criar meu evento
              </Link>

              <a
                href="#como-funciona"
                className="w-full rounded-full border border-[#d9d1ca] bg-white px-7 py-4 text-center font-medium text-[#433d38] transition hover:bg-[#f6f1ed] sm:w-auto"
              >
                Descobrir como funciona
              </a>
            </div>

            <div className="mt-8 flex w-full flex-wrap gap-x-7 gap-y-3 text-sm text-[#847b74]">
              <span>✓ Página personalizada</span>
              <span>✓ Lista de presentes</span>
              <span>✓ Pagamento online</span>
            </div>
          </div>

          {/* CAROUSEL */}
          <div className="w-full min-w-0">
            <div className="w-full min-w-0">
              <EventPerspectiveCarousel />
            </div>
          </div>

        </div>
      </section>

      {/* FRASE / MARCA */}
      <section className="border-y border-[#ebe4de] bg-white px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">

          <p className="max-w-xl font-serif text-2xl leading-tight text-[#37312d] md:text-3xl">
            “Mais do que uma lista de presentes, um espaço para celebrar
            uma nova história.”
          </p>

          <div className="text-sm uppercase tracking-[0.2em] text-[#9a918a]">
            WebGift
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-7xl">

          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b47b7f]">
                Feito para os noivos
              </p>

              <h2 className="mt-5 max-w-xl font-serif text-4xl leading-tight text-[#302b28] md:text-5xl">
                Seu evento merece mais do que uma lista improvisada.
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">

              <div className="rounded-3xl border border-[#e9e1db] bg-white p-7">
                <span className="text-2xl">📝</span>
                <h3 className="mt-5 text-xl font-medium">
                  Tudo organizado
                </h3>
                <p className="mt-3 leading-7 text-[#756d67]">
                  Presentes, mensagens e informações do evento reunidos
                  em uma única página.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e9e1db] bg-white p-7">
                <span className="text-2xl">💌</span>
                <h3 className="mt-5 text-xl font-medium">
                  Um único link
                </h3>
                <p className="mt-3 leading-7 text-[#756d67]">
                  Compartilhe sua página pelo WhatsApp, convite digital ou
                  redes sociais.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e9e1db] bg-white p-7">
                <span className="text-2xl">🎁</span>
                <h3 className="mt-5 text-xl font-medium">
                  Presentes com significado
                </h3>
                <p className="mt-3 leading-7 text-[#756d67]">
                  Crie experiências, contribuições e presentes que tenham
                  significado para vocês.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e9e1db] bg-white p-7">
                <span className="text-2xl">✨</span>
                <h3 className="mt-5 text-xl font-medium">
                  Uma página especial
                </h3>
                <p className="mt-3 leading-7 text-[#756d67]">
                  Uma experiência pensada para combinar com a importância
                  desse momento.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section
        id="como-funciona"
        className="bg-[#2d2926] px-5 py-24 text-white md:px-8 md:py-32"
      >
        <div className="mx-auto max-w-7xl">

          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#d6a8ab]">
              Como funciona
            </p>

            <h2 className="mt-5 font-serif text-4xl leading-tight md:text-6xl">
              Do primeiro clique ao presente recebido.
            </h2>

            <p className="mt-6 text-lg leading-8 text-white/60">
              Uma experiência simples para os noivos e ainda mais simples
              para quem quer presentear.
            </p>
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {etapas.map((etapa) => (
              <div
                key={etapa.number}
                className="bg-[#2d2926] p-7 transition hover:bg-[#37312e]"
              >
                <span className="text-sm text-[#d6a8ab]">
                  {etapa.number}
                </span>

                <h3 className="mt-10 text-xl font-medium">
                  {etapa.title}
                </h3>

                <p className="mt-4 leading-7 text-white/55">
                  {etapa.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRESENTES */}
      <section
        id="presentes"
        className="px-5 py-24 md:px-8 md:py-32"
      >
        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b47b7f]">
                A lista de presentes
              </p>

              <h2 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">
                Presentes que contam uma história.
              </h2>
            </div>

            <p className="max-w-md leading-7 text-[#756d67]">
              Em vez de apenas produtos, os noivos podem criar momentos,
              experiências e objetivos para a nova vida juntos.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {presentes.map((presente) => (
              <div
                key={presente.title}
                className="group rounded-[28px] border border-[#e8e0da] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5"
              >
                <div className="flex items-start justify-between">
                  <span className="text-4xl">
                    {presente.icon}
                  </span>

                  <span className="rounded-full bg-[#f7efed] px-3 py-1 text-xs text-[#8c6265]">
                    presente
                  </span>
                </div>

                <h3 className="mt-10 font-serif text-3xl">
                  {presente.title}
                </h3>

                <p className="mt-4 min-h-[56px] leading-7 text-[#756d67]">
                  {presente.description}
                </p>

                <div className="mt-8 flex items-center justify-between border-t border-[#ece5df] pt-5">
                  <span className="text-sm text-[#928982]">
                    A partir de
                  </span>

                  <span className="text-lg font-semibold">
                    {presente.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-[#efe6e1] p-8 md:flex md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#9a716f]">
                Mais liberdade
              </p>

              <h3 className="mt-2 font-serif text-3xl">
                Crie os presentes do jeito que quiser.
              </h3>
            </div>

            <Link
              href="/login"
              className="mt-6 inline-flex rounded-full bg-[#2d2926] px-6 py-3 font-medium text-white transition hover:bg-[#46403b] md:mt-0"
            >
              Quero criar minha lista
            </Link>
          </div>

        </div>
      </section>

      {/* MOCKUP / EXPLICAÇÃO */}
      <section className="bg-[#f1ece7] px-5 py-24 md:px-8 md:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">

          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-[30px] border border-black/5 bg-white p-4 shadow-xl">

              <div className="rounded-[24px] bg-[#faf8f6] p-5">

                <div className="flex items-center justify-between border-b border-[#e8e0da] pb-5">
                  <div>
                    <p className="font-serif text-xl">
                      João & Maria
                    </p>

                    <p className="mt-1 text-xs text-[#8d847d]">
                      Nosso casamento · 15.11.2026
                    </p>
                  </div>

                  <div className="rounded-full bg-[#efe0df] px-3 py-1 text-xs text-[#8e6265]">
                    publicado
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">☕</span>

                      <div>
                        <p className="font-medium">
                          Cafeteira
                        </p>

                        <p className="text-xs text-[#918981]">
                          R$ 450,00
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-1.5 rounded-full bg-[#ece6e1]">
                      <div className="h-full w-full rounded-full bg-[#b47b7f]" />
                    </div>

                    <p className="mt-2 text-xs text-[#8e8680]">
                      Presente recebido
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✈️</span>

                      <div>
                        <p className="font-medium">
                          Lua de mel
                        </p>

                        <p className="text-xs text-[#918981]">
                          R$ 2.000,00
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-1.5 rounded-full bg-[#ece6e1]">
                      <div className="h-full w-[65%] rounded-full bg-[#b47b7f]" />
                    </div>

                    <p className="mt-2 text-xs text-[#8e8680]">
                      R$ 1.300 recebidos
                    </p>
                  </div>

                </div>

                <div className="mt-4 rounded-2xl bg-[#2d2926] p-5 text-white">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    Total recebido
                  </p>

                  <p className="mt-2 font-serif text-4xl">
                    R$ 1.750,00
                  </p>
                </div>

              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">

            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b47b7f]">
              Tudo em um só lugar
            </p>

            <h2 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">
              Uma experiência bonita para quem recebe e para quem presenteia.
            </h2>

            <p className="mt-6 text-lg leading-8 text-[#756d67]">
              A página do evento concentra as informações mais importantes
              e transforma a lista de presentes em parte da experiência do
              convidado.
            </p>

            <div className="mt-9 space-y-5">

              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  ✓
                </div>

                <div>
                  <h3 className="font-medium">
                    Página personalizada
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#817971]">
                    Nomes, data, fotos, mensagem e link próprio.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  ✓
                </div>

                <div>
                  <h3 className="font-medium">
                    Lista flexível
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#817971]">
                    Presentes simbólicos, valores diferentes e contribuições.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  ✓
                </div>

                <div>
                  <h3 className="font-medium">
                    Experiência simples
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#817971]">
                    O convidado escolhe, paga e deixa uma mensagem.
                  </p>
                </div>
              </div>

            </div>

            <Link
              href="/cadastro"
              className="mt-9 inline-flex rounded-full bg-[#2d2926] px-7 py-4 font-medium text-white transition hover:bg-[#46403b]"
            >
              Começar agora
            </Link>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-24 md:px-8 md:py-32">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[38px] bg-[#d9bbb8] px-7 py-20 text-center md:px-16">

          <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-[#a77878]/20 blur-2xl" />

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#785d5b]">
              O começo da sua história
            </p>

            <h2 className="mx-auto mt-5 max-w-3xl font-serif text-4xl leading-tight text-[#342a28] md:text-6xl">
              Crie um evento que seus convidados vão lembrar.
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#604f4d]">
              Monte sua página, escolha seus presentes e compartilhe esse
              momento com quem você ama.
            </p>

            <Link
              href="/login"
              className="mt-9 inline-flex rounded-full bg-[#2d2926] px-8 py-4 font-medium text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#46403b]"
            >
              Criar meu evento
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="duvidas"
        className="border-t border-[#ebe4de] bg-white px-5 py-24 md:px-8 md:py-32"
      >
        <div className="mx-auto max-w-4xl">

          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#b47b7f]">
              Dúvidas
            </p>

            <h2 className="mt-5 font-serif text-4xl md:text-5xl">
              Tire suas dúvidas.
            </h2>
          </div>

          <div className="mt-14 space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-[#e8e0da] bg-[#fcfaf8] px-6 py-5"
              >
                <summary className="cursor-pointer list-none font-medium text-[#39332f] marker:hidden">
                  <div className="flex items-center justify-between gap-5">
                    <span>{faq.question}</span>

                    <span className="text-xl text-[#a27a7d] transition group-open:rotate-45">
                      +
                    </span>
                  </div>
                </summary>

                <p className="max-w-3xl pt-4 leading-7 text-[#756d67]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#2d2926] px-5 py-12 text-white md:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">

            <div>
              <Link
                href="/"
                className="font-serif text-2xl"
              >
                Web<span className="italic text-[#d6a8ab]">Gift</span>
              </Link>

              <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">
                Uma nova forma de criar, compartilhar e celebrar a lista de
                presentes do seu evento.
              </p>
            </div>

            <div className="flex flex-wrap gap-5 text-sm text-white/60">
              <a href="#como-funciona" className="hover:text-white">
                Como funciona
              </a>

              <a href="#presentes" className="hover:text-white">
                Presentes
              </a>

              <a href="#duvidas" className="hover:text-white">
                Dúvidas
              </a>

              <Link href="/login" className="hover:text-white">
                Entrar
              </Link>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/35">
            © {new Date().getFullYear()} WebGift. Todos os direitos
            reservados.
          </div>

        </div>
      </footer>
    </main>
  );
}