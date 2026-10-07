"use client";

import { Autoplay, EffectCoverflow, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

const events = [
  {
    type: "CASAMENTO",
    title: "João & Maria",
    date: "15 · 11 · 2026",
    description: "Nossa lista de presentes",
    icon: "💍",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85",
    color: "from-black/70 via-black/20 to-black/40",
    badge: "lista de casamento",
  },
  {
    type: "CHÁ DE PANELA",
    title: "João & Maria",
    date: "20 · 10 · 2026",
    description: "Ajude a montar nossa nova casa",
    icon: "🍳",
    image:
      "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=85",
    color: "from-black/60 via-black/10 to-black/50",
    badge: "lista de presentes",
  },
  {
    type: "CHÁ DE BEBÊ",
    title: "Bem-vinda, Alice",
    date: "08 · 12 · 2026",
    description: "Um presente para essa nova fase",
    icon: "🧸",
    image:
      "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=85",
    color: "from-black/55 via-black/10 to-black/45",
    badge: "chá de bebê",
  },
  {
    type: "ANIVERSÁRIO",
    title: "João · 30 anos",
    date: "05 · 09 · 2026",
    description: "Celebre esse dia comigo",
    icon: "🎉",
    image:
      "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=85",
    color: "from-black/60 via-black/10 to-black/45",
    badge: "lista de presentes",
  },
];
const carouselEvents = [...events, ...events];
export default function EventPerspectiveCarousel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]">

      {/* Glow atrás do carousel */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dcb7b6]/40 blur-[100px]" />
      </div>

      <Swiper
        modules={[EffectCoverflow, Autoplay, Pagination]}
        effect="coverflow"
        grabCursor={true}
        centeredSlides={true}
        slidesPerView={1.15}
        loop={true}
        speed={900}
        autoplay={{
          delay: 1700,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{
          clickable: true,
        }}
        coverflowEffect={{
          rotate: 12,
          stretch: 0,
          depth: 140,
          modifier: 1.7,
          slideShadows: false,
        }}
        className="gift-perspective-carousel !pb-12"
      >
        {carouselEvents.map((event, index) => (
          <SwiperSlide key={`${event.type}-${index}`}>
            <div className="relative mx-auto aspect-[4/4] w-full overflow-hidden rounded-[34px] bg-white shadow-2xl shadow-black/20">

              {/* Foto */}
              <img
                src={event.image}
                alt={event.type}
                className="absolute inset-0 h-full w-full object-cover"
              />

              {/* Overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-b ${event.color}`}
              />

              {/* Conteúdo */}
              <div className="relative flex h-full flex-col items-center justify-center px-8 text-center text-white">

                <div className="mb-7 flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 backdrop-blur-md">
                  <span className="text-sm">
                    {event.icon}
                  </span>

                  <span className="text-[10px] font-medium uppercase tracking-[0.32em]">
                    {event.type}
                  </span>
                </div>

                <h2 className="font-serif text-4xl italic leading-tight sm:text-5xl md:text-6xl">
                  {event.title}
                </h2>

                <p className="mt-5 text-xs tracking-[0.3em] text-white/90">
                  {event.date}
                </p>

                <div className="mt-9 rounded-full border border-white/40 bg-black/20 px-5 py-2.5 text-xs font-medium backdrop-blur-md">
                  {event.description}
                </div>
              </div>

              {/* Card inferior */}
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/95 p-4 text-left shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">

                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#958b84]">
                      WebGift
                    </p>

                    <p className="mt-1 text-sm font-medium text-[#342f2b]">
                      {event.badge}
                    </p>
                  </div>

                  <div className="rounded-full bg-[#f3e2e1] px-4 py-2 text-xs font-medium text-[#8b6265]">
                    Ver lista
                  </div>

                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}