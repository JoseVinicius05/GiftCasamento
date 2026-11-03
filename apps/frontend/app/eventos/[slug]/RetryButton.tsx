'use client';

import { useRouter } from 'next/navigation';

// "Tentar novamente" das telas de erro do painel. Precisa ser um componente de
// cliente: a página do painel é um Server Component e não pode passar `onClick`
// direto num <button> (o Next recusa assim que a tela de erro é renderizada).
// router.refresh() refaz as buscas da página sem recarregar o navegador.
export default function RetryButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c4777d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b66b72] focus:outline-none focus:ring-4 focus:ring-[#b47b7f]/20 sm:w-auto"
    >
      Tentar novamente
    </button>
  );
}
