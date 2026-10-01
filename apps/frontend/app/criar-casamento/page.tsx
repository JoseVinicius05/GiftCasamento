"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function gerarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mesmos valores do enum EventType no Prisma — se adicionar um tipo novo,
// precisa espelhar aqui e no schema.prisma.
const EVENT_TYPES = [
  { value: "casamento", label: "Casamento" },
  { value: "aniversario", label: "Aniversário" },
  { value: "cha_de_bebe", label: "Chá de bebê" },
  { value: "cha_de_cozinha", label: "Chá de cozinha" },
  { value: "outro", label: "Outro" },
] as const;

type EventType = (typeof EVENT_TYPES)[number]["value"] | "";

export default function CriarCasamentoPage() {
  const router = useRouter();
  const [eventType, setEventType] = useState<EventType>("");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [slug, setSlug] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleTitleChange(valor: string) {
    setTitle(valor);
    setSlug(gerarSlug(valor));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!eventType) {
      setError("Escolha o tipo do evento.");
      return;
    }
    if (!title.trim()) {
      setError("Dê um título para o seu evento.");
      return;
    }
    if (!eventDate) {
      setError("Escolha a data do evento.");
      return;
    }
    if (!pixKey.trim()) {
      setError("Informe sua chave Pix — ela é usada pra gerar o QR code dos presentes.");
      return;
    }
    if (guestPassword.trim().length < 4) {
      setError("A senha dos convidados precisa ter pelo menos 4 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, eventType, eventDate, guestPassword, pixKey }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login?redirectTo=/criar-casamento");
          return;
        }
        const message = Array.isArray(data.message) ? data.message[0] : data.message;
        setError(message ?? "Não foi possível criar o evento.");
        return;
      }

      router.push("/meus-eventos");
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
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
            Crie a página do seu evento
          </h1>

          <p className="mt-3 text-gray-500">
            Preencha os dados abaixo. Você poderá alterar tudo depois.
          </p>
        </div>

        {/* Formulário */}
        <section className="rounded-3xl bg-white p-6 shadow-sm md:p-10">

          <form className="space-y-7" onSubmit={handleSubmit}>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Tipo de evento */}
            <div>
              <label
                htmlFor="eventType"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Tipo de evento
              </label>

              <select
                id="eventType"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-800 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              >
                <option value="">Selecione...</option>
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div>
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Título do evento
              </label>

              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ex.: Ana & João, Aniversário de 30 anos da Marina..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
              />

              <p className="mt-2 text-xs text-gray-400">
                É isso que os convidados vão ver no topo da sua página.
              </p>
            </div>

            {/* Data */}
            <div>
              <label
                htmlFor="date"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Data do evento
              </label>

              <input
                id="date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
              />
            </div>

            {/* Chave Pix — sempre obrigatória. Qualquer presente pode ser pago
                via Pix (integral ou por cota); o link da loja é um dado de
                cada presente, não uma escolha do evento. */}
            <div>
              <label
                htmlFor="pixKey"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Sua chave Pix
              </label>

              <input
                id="pixKey"
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
              />

              <p className="mt-2 text-xs text-gray-400">
                Usada pra gerar o QR code com o valor certo quando um convidado
                for pagar um presente (integral ou por cota).
              </p>
            </div>

            {/* Senha do convidado */}
            <div>
              <label
                htmlFor="guestPassword"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Senha de acesso dos convidados
              </label>

              <input
                id="guestPassword"
                type="text"
                value={guestPassword}
                onChange={(e) => setGuestPassword(e.target.value)}
                placeholder="Uma senha simples pra compartilhar com os convidados"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800"
              />

              <p className="mt-2 text-xs text-gray-400">
                Não precisa ser complexa — é só pra impedir acesso de quem não foi convidado.
                Você vai compartilhar ela junto com o link da sua página.
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
                Esse é só um preview — o endereço final ganha um código extra do
                servidor pra garantir que não existe outro igual.
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
              disabled={loading}
              className="w-full rounded-xl bg-pink-500 px-6 py-4 font-semibold text-white transition hover:bg-pink-600 disabled:opacity-50"
            >
              {loading ? "Criando evento..." : "Criar meu evento"}
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
