"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, CalendarDays, Gift, KeyRound, Link as LinkIcon } from "lucide-react";
import {
  ChevronDown,
  Check,
  Heart,
  Cake,
  Baby,
  Utensils,
  Sparkles,
} from "lucide-react";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function gerarSlug(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mesmos valores do enum EventType no Prisma
const EVENT_TYPES = [
  { value: "casamento", label: "Casamento" },
  { value: "aniversario", label: "Aniversário" },
  { value: "cha_de_bebe", label: "Chá de bebê" },
  { value: "cha_de_cozinha", label: "Chá de cozinha" },
  { value: "outro", label: "Outro" },
] as const;

type EventType = (typeof EVENT_TYPES)[number]["value"] | "";

const EVENT_ICONS = {
  casamento: Heart,
  aniversario: Cake,
  cha_de_bebe: Baby,
  cha_de_cozinha: Utensils,
  outro: Sparkles,
};




export default function CriarCasamentoPage() {
  const router = useRouter();

  const [eventType, setEventType] = useState<EventType>("");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [slug, setSlug] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [eventOpen, setEventOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleTitleChange(valor: string) {
    setTitle(valor);
    setSlug(gerarSlug(valor));
  }

  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }

  function selectDate(day: number) {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayFormatted = String(date.getDate()).padStart(2, "0");

    setEventDate(`${year}-${month}-${dayFormatted}`);
    setCalendarOpen(false);
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
      setError(
        "Informe sua chave Pix — ela é usada pra gerar o QR code dos presentes."
      );
      return;
    }

    if (guestPassword.trim().length < 4) {
      setError(
        "A senha dos convidados precisa ter pelo menos 4 caracteres."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          eventType,
          eventDate,
          guestPassword,
          pixKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login?redirectTo=/criar-casamento");
          return;
        }

        const message = Array.isArray(data.message)
          ? data.message[0]
          : data.message;

        setError(message ?? "Não foi possível criar o evento.");
        return;
      }

      router.push("/meus-eventos");
    } catch {
      setError(
        "Não foi possível conectar ao servidor. Tente novamente em instantes."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh w-full overflow-hidden px-4 py-10">

      {/* ========================================= */}
      {/* BACKGROUND */}
      {/* ========================================= */}

      <div
        className="fixed inset-0 -z-20 bg-[#fff7f8] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/background.png')",
        }}
      />

      {/* Camada rosada */}
      <div className="fixed inset-0 -z-10 bg-[#fff7f8]/45" />

      {/* Blur */}
      <div className="fixed inset-0 -z-10 backdrop-blur-[1px]" />

      {/* ========================================= */}
      {/* DECORAÇÕES */}
      {/* ========================================= */}

      <div
        className="
          pointer-events-none
          fixed
          -left-32
          -top-32
          h-96
          w-96
          rounded-full
          bg-[#e8caca]/30
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          fixed
          -bottom-40
          -right-32
          h-96
          w-96
          rounded-full
          bg-[#ead6d6]/40
          blur-3xl
        "
      />

      {/* ========================================= */}
      {/* CONTEÚDO */}
      {/* ========================================= */}

      <div className="relative mx-auto w-full max-w-3xl">

        {/* ========================================= */}
        {/* CABEÇALHO */}
        {/* ========================================= */}

        <div className="mb-8 text-center">

          <h1 className="font-serif text-5xl tracking-tight text-[#302b28]">
            Web<span className="italic text-[#b47b7f]">Gift</span>
          </h1>

          <p className="mt-2 text-gray-500">
            Crie a página do seu evento
          </p>

          <p className="mt-1 text-sm text-gray-400">
            Preencha os dados abaixo. Você poderá alterar tudo depois.
          </p>

        </div>

        {/* ========================================= */}
        {/* CARD */}
        {/* ========================================= */}

        <section
          className="
            rounded-[28px]
            border
            border-white/70
            bg-white/75
            p-6
            shadow-2xl
            backdrop-blur-xl
            md:p-10
          "
        >

          <form
            className="space-y-7"
            onSubmit={handleSubmit}
          >

            {/* ========================================= */}
            {/* ERRO */}
            {/* ========================================= */}

            {error && (
              <div
                className="
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50/90
                  px-4
                  py-3
                  text-sm
                  text-red-600
                "
              >
                {error}
              </div>
            )}

            {/* ========================================= */}
            {/* TIPO DE EVENTO */}
            {/* ========================================= */}

            <div>

              <label
                htmlFor="eventType"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Tipo de evento
              </label>

              <div className="relative">

                <Gift
                  className="
                    pointer-events-none
                    absolute
                    left-4
                    top-1/2
                    h-5
                    w-5
                    -translate-y-1/2
                    text-[#b47b7f]
                  "
                />
                <div className="relative">

                  {/* BOTÃO DO COMBOBOX */}
                  <button
                    type="button"
                    onClick={() => setEventOpen(!eventOpen)}
                    className={`
      flex
      w-full
      items-center
      justify-between
      rounded-xl
      border
      bg-white/80
      px-4
      py-3
      text-left
      outline-none
      transition-all
      duration-200
      ${eventOpen
                        ? "border-[#c4777d] ring-2 ring-[#c4777d]/20"
                        : "border-gray-300 hover:border-[#d5a0a4]"
                      }
    `}
                  >

                    <div className="flex items-center gap-3">

                      {eventType ? (
                        <>
                          {(() => {
                            const Icon = EVENT_ICONS[eventType];

                            return (
                              <div
                                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  bg-[#f7e6e7]
                  text-[#b47b7f]
                "
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                            );
                          })()}

                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {
                                EVENT_TYPES.find(
                                  (type) => type.value === eventType
                                )?.label
                              }
                            </p>

                            <p className="text-xs text-gray-400">
                              Tipo de evento selecionado
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              bg-[#f7e6e7]
              text-[#b47b7f]
            "
                          >
                            <Gift className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="text-sm text-gray-500">
                              Selecione o tipo
                            </p>

                            <p className="text-xs text-gray-400">
                              Escolha uma opção
                            </p>
                          </div>
                        </>
                      )}

                    </div>

                    <ChevronDown
                      className={`
        h-5
        w-5
        text-gray-400
        transition-transform
        duration-200
        ${eventOpen ? "rotate-180" : ""}
      `} />

                  </button>


                  {/* LISTA */}
                  {eventOpen && (
                    <div
                      className="
        absolute
        left-0
        right-0
        top-[calc(100%+8px)]
        z-50
        overflow-hidden
        rounded-2xl
        border
        border-white/80
        bg-white/95
        p-2
        shadow-2xl
        backdrop-blur-xl">

                      {/* CABEÇALHO */}
                      <div className="px-3 pb-2 pt-2">

                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Tipo de evento
                        </p>

                      </div>


                      {/* OPÇÕES */}
                      <div className="space-y-1">

                        {EVENT_TYPES.map((type) => {

                          const Icon = EVENT_ICONS[type.value];

                          const selected = eventType === type.value;

                          return (
                            <button key={type.value} type="button" onClick={() => {
                              setEventType(type.value);
                              setEventOpen(false);
                            }}
                              className={`group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all duration-150 ${selected ? "bg-[#f8e9ea]" : "hover:bg-[#fff5f6]"}`}>

                              <div className="flex items-center gap-3">
                                {/* ÍCONE */}
                                <div
                                  className={`
                                    flex
                                    h-10
                                    w-10
                                    items-center
                                    justify-center
                                    rounded-xl
                                    transition-all
                    ${selected ? "bg-[#c4777d] text-white shadow-sm" : "bg-[#f8e9ea] text-[#b47b7f] group-hover:bg-[#f3dcde]"}`}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                {/* TEXTO */}
                                <div>
                                  <p className={`text-sm font-medium ${selected ? "text-[#a85f66]" : "text-gray-700"}`}>
                                    {type.label}
                                  </p>

                                  <p className="text-xs text-gray-400">
                                    {type.value === "casamento" &&
                                      "Celebre o seu grande dia"}

                                    {type.value === "aniversario" &&
                                      "Comemore uma nova fase"}

                                    {type.value === "cha_de_bebe" &&
                                      "Prepare-se para a chegada"}

                                    {type.value === "cha_de_cozinha" &&
                                      "Celebre com amigos e família"}

                                    {type.value === "outro" &&
                                      "Crie um evento personalizado"}
                                  </p>

                                </div>

                              </div>


                              {/* CHECK */}
                              {selected && (
                                <div
                                  className="
                    flex
                    h-6
                    w-6
                    items-center
                    justify-center
                    rounded-full
                    bg-[#c4777d]
                    text-white
                  "
                                >
                                  <Check className="h-4 w-4" />
                                </div>
                              )}

                            </button>
                          );

                        })}

                      </div>

                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* ========================================= */}
            {/* TÍTULO */}
            {/* ========================================= */}

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
                onChange={(e) =>
                  handleTitleChange(e.target.value)
                }
                placeholder="Ex.: Ana & João, Aniversário de 30 anos da Marina..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-300
                  bg-white/80
                  px-4
                  py-3
                  text-gray-800
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-[#c4777d]
                  focus:ring-2
                  focus:ring-[#c4777d]/20
                "
              />

              <p className="mt-2 text-xs text-gray-400">
                É isso que os convidados vão ver no topo da sua página.
              </p>

            </div>

            {/* ========================================= */}
            {/* DATA */}
            {/* ========================================= */}

            <div className="relative">
              <label
                htmlFor="eventDate"
                className="mb-2 block text-sm font-medium text-[#342f2b]"
              >
                Data do evento
              </label>

              {/* Botão do calendário */}
              <button
                type="button"
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="group flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-[#c4777d] hover:bg-white focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3e2e1] text-[#b47b7f] transition group-hover:bg-[#ead1d2]">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">
                      Data do evento
                    </p>

                    <p className="font-medium text-gray-800">
                      {eventDate
                        ? new Date(`${eventDate}T00:00:00`).toLocaleDateString(
                          "pt-BR",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          }
                        )
                        : "Selecione uma data"}
                    </p>
                  </div>
                </div>

                <ChevronRight
                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${calendarOpen ? "rotate-90" : ""
                    }`}
                />
              </button>

              {/* Calendário */}
              {calendarOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">

                  {/* Cabeçalho */}
                  <div className="mb-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMonth(
                          new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() - 1,
                            1
                          )
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#f3e2e1] hover:text-[#b47b7f]"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="text-center">
                      <p className="font-serif text-lg font-semibold capitalize text-[#342f2b]">
                        {months[currentMonth.getMonth()]}
                      </p>

                      <p className="text-xs text-gray-400">
                        {currentMonth.getFullYear()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMonth(
                          new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() + 1,
                            1
                          )
                        )
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#f3e2e1] hover:text-[#b47b7f]"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Dias da semana */}
                  <div className="mb-2 grid grid-cols-7">
                    {weekDays.map((day, index) => (
                      <div
                        key={index}
                        className="py-2 text-center text-xs font-semibold text-gray-400"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Dias */}
                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(currentMonth).map((day, index) => {
                      if (day === null) {
                        return <div key={index} />;
                      }

                      const dateString = `${currentMonth.getFullYear()}-${String(
                        currentMonth.getMonth() + 1
                      ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                      const selected = eventDate === dateString;

                      const today = new Date();

                      const isToday =
                        day === today.getDate() &&
                        currentMonth.getMonth() === today.getMonth() &&
                        currentMonth.getFullYear() === today.getFullYear();

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => selectDate(day)}
                          className={`relative flex h-10 items-center justify-center rounded-xl text-sm transition-all duration-200
                ${selected
                              ? "bg-[#c4777d] font-semibold text-white shadow-md"
                              : "text-gray-700 hover:bg-[#f3e2e1] hover:text-[#b47b7f]"
                            }
              `}
                        >
                          {day}

                          {isToday && !selected && (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#c4777d]" />
                          )}

                          {selected && (
                            <Check className="absolute right-1 top-1 h-3 w-3" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Rodapé */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();

                        setCurrentMonth(
                          new Date(today.getFullYear(), today.getMonth(), 1)
                        );

                        selectDate(today.getDate());
                      }}
                      className="w-full rounded-xl py-2 text-sm font-medium text-[#b47b7f] transition hover:bg-[#f8eeee]"
                    >
                      Hoje
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================= */}
            {/* PIX */}
            {/* ========================================= */}

            <div>

              <label
                htmlFor="pixKey"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Sua chave Pix
              </label>

              <div className="relative">

                <KeyRound
                  className="
                    pointer-events-none
                    absolute
                    left-4
                    top-1/2
                    h-5
                    w-5
                    -translate-y-1/2
                    text-[#b47b7f]
                  "
                />

                <input
                  id="pixKey"
                  type="text"
                  value={pixKey}
                  onChange={(e) =>
                    setPixKey(e.target.value)
                  }
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-300
                    bg-white/80
                    px-4
                    py-3
                    pl-12
                    text-gray-800
                    outline-none
                    transition
                    placeholder:text-gray-400
                    focus:border-[#c4777d]
                    focus:ring-2
                    focus:ring-[#c4777d]/20
                  "
                />

              </div>

              <p className="mt-2 text-xs text-gray-400">
                Usada pra gerar o QR code com o valor certo quando um
                convidado for pagar um presente.
              </p>

            </div>

            {/* ========================================= */}
            {/* SENHA DOS CONVIDADOS */}
            {/* ========================================= */}

            <div>

              <label
                htmlFor="guestPassword"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Senha de acesso dos convidados
              </label>

              <div className="relative">

                <input
                  id="guestPassword"
                  type={showPassword ? "text" : "password"}
                  value={guestPassword}
                  onChange={(e) =>
                    setGuestPassword(e.target.value)
                  }
                  placeholder="Uma senha simples pra compartilhar"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-gray-300
                    bg-white/80
                    px-4
                    py-3
                    pr-12
                    text-gray-800
                    outline-none
                    transition
                    placeholder:text-gray-400
                    focus:border-[#c4777d]
                    focus:ring-2
                    focus:ring-[#c4777d]/20
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

              <p className="mt-2 text-xs text-gray-400">
                Não precisa ser complexa — é só pra impedir acesso
                de quem não foi convidado.
                Você vai compartilhar ela junto com o link da sua página.
              </p>

            </div>

            {/* ========================================= */}
            {/* SLUG */}
            {/* ========================================= */}

            <div>

              <label
                htmlFor="slug"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Endereço da sua página
              </label>

              <div
                className="
                  flex
                  flex-col
                  overflow-hidden
                  rounded-xl
                  border
                  border-gray-300
                  bg-white/80
                  md:flex-row
                "
              >

                <div
                  className="
                    flex
                    items-center
                    gap-2
                    bg-gray-100/80
                    px-4
                    py-3
                    text-sm
                    text-gray-500
                    md:whitespace-nowrap
                  "
                >
                  <LinkIcon className="h-4 w-4" />

                  WebGift.com/evento/
                </div>

                <input
                  id="slug"
                  type="text"
                  value={slug}
                  readOnly
                  onChange={(e) =>
                    setSlug(gerarSlug(e.target.value))
                  }
                  placeholder="jose-e-maria"
                  className="
                    min-w-0
                    flex-1
                    bg-transparent
                    px-4
                    py-3
                    text-gray-800
                    outline-none
                  "
                />

              </div>

              <p className="mt-2 text-xs text-gray-400">
                Esse é só um preview — o endereço final ganha um
                código extra do servidor pra garantir que não existe outro igual.
              </p>

            </div>

            {/* ========================================= */}
            {/* PREVIEW */}
            {/* ========================================= */}

            <div
              className="
                rounded-2xl
                border
                border-[#ead6d6]
                bg-[#fff7f8]/80
                p-5
              "
            >

              <p className="text-sm font-semibold text-[#b47b7f]">
                Seu endereço ficará assim:
              </p>

              <p className="mt-2 break-all font-medium text-gray-700">
                https://WebGift.com/evento/
                {slug || "jose-e-maria"}
              </p>

            </div>

            {/* ========================================= */}
            {/* BOTÃO */}
            {/* ========================================= */}

            <button
              type="submit"
              disabled={loading}
              className="
                group
                relative
                w-full
                overflow-hidden
                rounded-xl
                bg-[#c4777d]
                px-6
                py-4
                font-semibold
                text-white
                shadow-md
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:bg-[#b66b72]
                hover:shadow-lg
                active:translate-y-0
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >

              <span
                className="
                  absolute
                  inset-0
                  -translate-x-full
                  bg-gradient-to-r
                  from-transparent
                  via-white/20
                  to-transparent
                  transition-transform
                  duration-700
                  group-hover:translate-x-full
                "
              />

              <span className="relative">
                {loading
                  ? "Criando evento..."
                  : "Criar meu evento"}
              </span>

            </button>

          </form>

        </section>

        {/* ========================================= */}
        {/* RODAPÉ */}
        {/* ========================================= */}

        <p className="mt-6 text-center text-sm text-gray-400">
          Você poderá editar essas informações depois.
        </p>

      </div>

    </main>
  );
}