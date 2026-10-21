'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Heart,
  LoaderCircle,
  Save,
  AlertCircle,
  Pencil,
  X,
  Check,
  Gift,
  Cake,
  Baby,
  Utensils,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  KeyRound,
} from 'lucide-react';

type EventTypeValue =
  | 'casamento'
  | 'aniversario'
  | 'cha_de_bebe'
  | 'cha_de_cozinha'
  | 'outro';

const EVENT_TYPES: { value: EventTypeValue; label: string }[] = [
  { value: 'casamento', label: 'Casamento' },
  { value: 'aniversario', label: 'Aniversário' },
  { value: 'cha_de_bebe', label: 'Chá de bebê' },
  { value: 'cha_de_cozinha', label: 'Chá de cozinha' },
  { value: 'outro', label: 'Outro' },
];

type Props = {
  slug: string;
  initialTitle: string;
  initialEventType: EventTypeValue;
  initialEventDate: string;
  initialPixKey: string;
  initialGuestPassword: string ;
};

const EVENT_ICONS = {
  casamento: Heart,
  aniversario: Cake,
  cha_de_bebe: Baby,
  cha_de_cozinha: Utensils,
  outro: Sparkles,
};

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

export default function EditEventForm({
  slug,
  initialTitle,
  initialEventType,
  initialEventDate,
  initialPixKey,
  initialGuestPassword,
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initialTitle);
  const [eventType, setEventType] =
    useState<EventTypeValue>(initialEventType);
  const [eventDate, setEventDate] = useState(initialEventDate);
  const [pixKey, setPixKey] = useState(initialPixKey);
  const [guestPasswordHash, setGuestPassword] = useState(initialGuestPassword);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const labelClass = "mb-2 block text-sm font-semibold text-gray-700";

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!title.trim()) {
      setError('O título não pode ficar vazio.');
      return;
    }

    if (!eventDate) {
      setError('Informe a data do evento.');
      return;
    }

    // Compara datas no formato YYYY-MM-DD usando a data local.
    const today = new Date();
    const localToday = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    if (eventDate < localToday) {
      setError('A data do evento não pode ser no passado.');
      return;
    }

    if (!pixKey.trim()) {
      setError('A chave Pix não pode ficar vazia.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          eventType,
          eventDate,
          pixKey: pixKey.trim(),
          guestPasswordHash,
        }),
      });

      const data = await response.json();
      console.log(data);
      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?redirectTo=/eventos/${slug}`);
          return;
        }

        const message = Array.isArray(data.message)
          ? data.message[0]
          : data.message;

        setError(message ?? 'Não foi possível salvar as alterações.');
        return;
      }

      setSuccess(true);
      setIsEditing(false);
      router.refresh();
    } catch {
      setError(
        'Não foi possível conectar ao servidor. Tente novamente em instantes.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (

    <form
      onSubmit={handleSubmit}
      className="relative w-full min-w-0 space-y-6 overflow-visible rounded-[24px] border border-white/70 bg-white/65 p-4 shadow-[0_20px_60px_rgba(115,77,77,0.10)] backdrop-blur-2xl sm:rounded-[28px] sm:p-6 md:p-8"
    >

      {/* Detalhe decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#e8caca]/30 blur-3xl"
      />

      {/* Cabeçalho */}

      {/* Cabeçalho */}
      <div className="relative flex min-w-0 items-start gap-3 border-b border-[#e9dada]/80 pb-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e8caca]/60 bg-[#fff0f1] text-[#b47b7f] sm:h-12 sm:w-12">
          <Pencil size={22} strokeWidth={1.7} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl text-[#302b28] sm:text-3xl">
            Editar evento
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#827573]">
            {isEditing
              ? 'Altere os dados do evento e salve quando terminar.'
              : 'Visualize os detalhes do evento. Clique em Editar para fazer alterações.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isEditing) {
              setTitle(initialTitle);
              setEventType(initialEventType);
              setEventDate(initialEventDate);
              setPixKey(initialPixKey);
              setGuestPassword(initialGuestPassword);
              setError(null);
              setSuccess(false);
              setEventOpen(false);
              setCalendarOpen(false);
              setIsEditing(false);
            } else {
              setIsEditing(true);
              setSuccess(false);
            }
          }}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#e8caca]/70 bg-white/80 px-3 py-2 text-sm font-semibold text-[#9d646a] shadow-sm transition hover:border-[#c4777d] hover:bg-[#fff0f1] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 sm:gap-2 sm:px-4"
        >
          {isEditing ? (
            <>
              <X size={16} />
              <span>Cancelar</span>
            </>
          ) : (
            <>
              <Pencil size={16} />
              <span>Editar</span>
            </>
          )}
        </button>
      </div>


      {/* Mensagens */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <p>Alterações salvas com sucesso!</p>
        </div>
      )}

      {/* Título */}
      <div>

        <label
          htmlFor="title"
          className={labelClass}
        >
          Título do evento
        </label>

        <input
          id="title"
          type="text"
          value={title}
          disabled={!isEditing || loading}
          onChange={(e) =>
            setTitle(e.target.value)
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
                  !isEditing:cursor-not-allowed disabled:bg-[#f7f1f1]/80 disabled:text-[#827573]
                "
        />

        <p className="mt-2 text-xs text-gray-400">
          É isso que os convidados vão ver no topo da sua página.
        </p>

      </div>

      {/* Tipo */}
      <div>
        <label
          htmlFor="eventType"
          className={labelClass}
        >
          Tipo de evento
        </label>

        <div className="relative">

          <div className="relative">

            {/* BOTÃO DO COMBOBOX */}
            <button
              type="button"
              disabled={!isEditing || loading}
              onClick={() => setEventOpen(!eventOpen)}
              className={`!isEditing:cursor-not-allowed disabled:bg-[#f7f1f1]/80 disabled:text-[#827573] flex w-full items-center justify-between rounded-xl border bg-white/80 px-4 py-3 text-left outline-none transition-all duration-200      ${eventOpen
                ? "border-[#c4777d] ring-2 ring-[#c4777d]/20"
                : "border-gray-300 hover:border-[#d5a0a4]"
                }
                      `}>

              <div className="flex items-center gap-3">

                {eventType ? (
                  <>
                    {(() => {
                      const Icon = EVENT_ICONS[eventType];

                      return (
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f7e6e7] text-[#b47b7f]"
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
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f7e6e7] text-[#b47b7f]"
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
                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${eventOpen ? "rotate-180" : ""} `} />
            </button>

            {/* LISTA */}
            {eventOpen && (
              <div
                className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl">

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
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c4777d] text-white"
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

      {/* Data */}
      <div className="relative">
        <label
          htmlFor="eventType"
          className={labelClass}
        >
          Data do evento
        </label>

        {/* Botão do calendário */}
        <button
          type="button"
          disabled={!isEditing || loading}
          onClick={() => setCalendarOpen(!calendarOpen)}
          className="!isEditing:cursor-not-allowed disabled:bg-[#f7f1f1]/80 disabled:text-[#827573] group flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-[#c4777d] hover:bg-white focus:outline-none"
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
          <div className="relative z-20 mt-3 w-full overflow-hidden rounded-2xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">


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

                const isPast = dateString < today.toISOString().slice(0, 10);

                return (
                  <button
                    key={index}
                    type="button"
                    disabled={isPast}
                    onClick={() => !isPast && selectDate(day)}
                    className={`relative flex h-10 items-center justify-center rounded-xl text-sm transition-all duration-200
                ${isPast
                        ? "cursor-not-allowed text-gray-300"
                        : selected
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

      {/* Pix */}
      <div>

        <label
          htmlFor="pixKey"
          className={labelClass}
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
            disabled={!isEditing || loading}
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
                    !isEditing:cursor-not-allowed disabled:bg-[#f7f1f1]/80 disabled:text-[#827573]
                  "
          />

        </div>

        <p className="mt-2 text-xs text-gray-400">
          Usada pra gerar o QR code com o valor certo quando um
          convidado for pagar um presente.
        </p>

      </div>

      <div>

        <label
          htmlFor="title"
          className={labelClass}
        >
          Senha do evento
        </label>

        <input
          id="guestPasswordHash"
          type="text"
          value={guestPasswordHash}
          disabled={!isEditing || loading}
          onChange={(e) =>
            setGuestPassword(e.target.value)
          }
          placeholder="Senha para o evento"
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
                  !isEditing:cursor-not-allowed disabled:bg-[#f7f1f1]/80 disabled:text-[#827573]
                "
        />

        <p className="mt-2 text-xs text-gray-400">
          Essa senha é para o convidado acessaar a lista dos presentes.
        </p>

      </div>

      {/* Botão */}

      {/* Botão: aparece somente no modo de edição */}
      {isEditing && (
        <div className="border-t border-[#e9dada]/80 pt-5">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c4777d] px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-[#b47b7f]/20 transition hover:bg-[#b66b72] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
          >
            {loading ? (
              <>
                <LoaderCircle size={19} className="animate-spin" />
                Salvando alterações...
              </>
            ) : (
              <>
                <Save size={18} />
                Salvar alterações
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-[#968986]">
            Revise os dados antes de confirmar as alterações.
          </p>
        </div>
      )}

    </form>
  );
}
