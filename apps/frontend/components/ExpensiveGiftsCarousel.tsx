
'use client';

import { useMemo } from 'react';
import { ArrowUpRight, Gift, Heart, Sparkles } from 'lucide-react';
import { Autoplay, EffectCoverflow, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';

export type ExpensiveGift = {
    id: string;
    title: string;
    price: number;
    imageUrl?: string | null;
    href: string;
};

type ExpensiveGiftsCarouselProps = {
    gifts: ExpensiveGift[];
};

export default function ExpensiveGiftsCarousel({
    gifts,
}: ExpensiveGiftsCarouselProps) {
    const expensiveGifts = useMemo(
        () =>
            [...gifts]
                .sort((a, b) => b.price - a.price)
                .slice(0, 8),
        [gifts],
    );

    const formatPrice = (price: number) =>
        price.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });

    function verPresente(giftId: string) {
        const elemento = document.querySelector(
            `[data-gift-id="${CSS.escape(giftId)}"]`,
        );

        if (!elemento) {
            console.warn('Presente não encontrado:', giftId);
            return;
        }

        elemento.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });

        // Destaca o presente temporariamente
        elemento.classList.add('ring-2', 'ring-[#c4777d]');

        window.setTimeout(() => {
            elemento.classList.remove('ring-2', 'ring-[#c4777d]');
        }, 2000);
    }

    if (expensiveGifts.length === 0) {
        return (
            <aside className="rounded-[28px] border border-[#f0dfe2] bg-white/85 p-6 text-center shadow-[0_12px_35px_rgba(115,77,77,0.08)]">
                <Gift className="mx-auto text-[#b47b7f]" size={28} />
                <h3 className="mt-3 font-serif text-xl text-[#302b28]">
                    Presentes especiais
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#786967]">
                    Os presentes em destaque aparecerão aqui.
                </p>
            </aside>
        );
    }

    return (
        <aside className="relative min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white/75 px-3 pb-3 pt-6 shadow-[0_20px_55px_rgba(115,77,77,0.10)] backdrop-blur-md sm:rounded-[32px] sm:px-5 sm:pt-7">
            {/* Brilho decorativo */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-28 -z-0 h-56 w-56 -translate-x-1/2 rounded-full bg-[#e8caca]/45 blur-[80px]"
            />

            <div className="relative z-10 mb-4 px-2 text-center">
                <p className="mb-2 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#b47b7f]">
                    <Sparkles size={13} />
                    Uma seleção especial
                </p>

                <h2 className="font-serif text-2xl leading-tight text-[#302b28] sm:text-3xl">
                    Presentes em destaque
                </h2>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#786967]">
                    Descubra alguns dos presentes de maior valor desta lista.
                </p>
            </div>

            <div className="relative z-10">
                <Swiper
                    modules={[EffectCoverflow, Autoplay, Pagination]}
                    effect="coverflow"
                    grabCursor
                    centeredSlides
                    slidesPerView={1.12}
                    loop={expensiveGifts.length > 2}
                    speed={900}
                    autoplay={{
                        delay: 2500,
                        disableOnInteraction: false,
                        pauseOnMouseEnter: true,
                    }}
                    pagination={{ clickable: true }}
                    coverflowEffect={{
                        rotate: 12,
                        stretch: 0,
                        depth: 140,
                        modifier: 1.7,
                        slideShadows: false,
                    }}
                    className="expensive-gifts-carousel !pb-12"
                >
                    {expensiveGifts.map((gift) => (
                        <SwiperSlide key={gift.id}>
                            <article className="relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-[#f5e8e8] shadow-xl shadow-[#302b28]/15 sm:rounded-[32px]">
                                {gift.imageUrl ? (
                                    <img
                                        src={gift.imageUrl}
                                        alt={gift.title}
                                        loading="lazy"
                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f8e8eb] via-[#fff7f8] to-[#e8caca]">
                                        <Gift
                                            size={64}
                                            strokeWidth={1}
                                            className="text-[#c18c91]"
                                        />
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/75" />

                                <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/25 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-md">
                                        <Heart size={12} />
                                        Em destaque
                                    </span>
                                    <span className="rounded-full border border-white/40 bg-white/90 px-3 py-2 text-xs font-bold text-[#9d646a] shadow-sm">
                                        {formatPrice(gift.price)}
                                    </span>
                                </div>

                                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                                    <div className="rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur-md sm:p-5">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b47b7f]">
                                            WebGift
                                        </p>

                                        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-[#302b28] sm:text-lg">
                                            {gift.title}
                                        </h3>

                                        <p className="mt-2 text-xl font-bold tracking-tight text-[#b46f76]">
                                            {formatPrice(gift.price)}
                                        </p>

                                        <button
                                            type="button"
                                            onClick={() => verPresente(gift.id)}
                                            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#c4777d] to-[#b66b72] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-105"
                                        >
                                            Ver presente
                                            <ArrowUpRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            <style jsx global>{`
        .expensive-gifts-carousel .swiper-pagination {
          bottom: 5px !important;
        }

        .expensive-gifts-carousel .swiper-pagination-bullet {
          background: #c4777d;
          opacity: 0.35;
        }

        .expensive-gifts-carousel .swiper-pagination-bullet-active {
          background: #b46f76;
          opacity: 1;
        }
      `}</style>
        </aside>
    );
}
