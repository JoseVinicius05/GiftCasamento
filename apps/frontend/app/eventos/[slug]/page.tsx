// Placeholder: o painel de verdade (dados do evento, lista de presentes)
// é construído no Dia 3. Por enquanto só existe pra "Meus eventos" ter um
// link funcional, conforme pedido no planejamento do Dia 2.
export default async function PainelEventoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-[#fff8fb] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800">Painel do evento</h1>
        <p className="mt-2 text-gray-500">
          Em construção — chega no Dia 3. Slug: <code>{slug}</code>
        </p>
      </div>
    </main>
  );
}
