"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AnimatedCreateEventProps {
  children?: React.ReactNode;
  className?: string;
}

export default function AnimatedCreateEvent({
  children = "Criar meu evento",
  className = "",
}: AnimatedCreateEventProps) {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(false);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    if (isAnimating) return;

    setIsAnimating(true);

    // Tempo necessário para a animação cobrir a tela
    setTimeout(() => {
      router.push("/login");
    }, 850);
  }

  return (
    <>
      <Link
        href="/login"
        onClick={handleClick}
        aria-busy={isAnimating}
        className={`
          group
          relative
          inline-flex
          items-center
          justify-center
          overflow-hidden
          rounded-full
          bg-[#2d2926]
          text-white
          shadow-lg
          shadow-black/10
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:bg-[#46403b]
          hover:shadow-xl
          active:scale-95
          ${isAnimating ? "pointer-events-none" : ""}
          ${className}
        `}
      >
        {/* Brilho do botão */}
        <span
          className={`
            pointer-events-none
            absolute
            inset-0
            -translate-x-full
            bg-gradient-to-r
            from-transparent
            via-white/20
            to-transparent
            transition-transform
            duration-700
            ${!isAnimating ? "group-hover:translate-x-full" : ""}
          `}
        />

        {/* Texto do botão */}
        <span
          className={`
            relative
            z-10
            transition-all
            duration-200
            ${
              isAnimating
                ? "scale-90 opacity-0"
                : "scale-100 opacity-100"
            }
          `}
        >
          {children}
        </span>

        {/* Presente */}
        <span
          className={`
            pointer-events-none
            absolute
            left-1/2
            top-1/2
            z-20
            -translate-x-1/2
            -translate-y-1/2
            text-4xl
            ${
              isAnimating
                ? "animate-gift-launch"
                : "scale-0 opacity-0"
            }
          `}
        >
          🎁
        </span>
      </Link>

      {/* ========================================= */}
      {/* TRANSIÇÃO ENTRE AS PÁGINAS */}
      {/* ========================================= */}

      {isAnimating && (
        <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
          {/* Fundo principal */}
          <div className="absolute inset-0 bg-[#fff7f8] animate-screen-cover" />

          {/* Gradiente suave */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(220,183,182,0.35),_transparent_55%)]" />

          {/* Círculo que cresce */}
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3e2e1] animate-transition-circle" />

          {/* Presente central */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="animate-transition-gift text-7xl drop-shadow-xl">
              🎁
            </div>
          </div>

          {/* Partículas */}
          <span className="absolute left-[42%] top-[48%] text-2xl animate-particle-one">
            ✦
          </span>

          <span className="absolute left-[58%] top-[45%] text-xl animate-particle-two">
            ✨
          </span>

          <span className="absolute left-[47%] top-[58%] text-xl animate-particle-three">
            ♥
          </span>

          <span className="absolute left-[55%] top-[57%] text-lg animate-particle-four">
            ✦
          </span>
        </div>
      )}

      <style jsx>{`
        /* =========================================
           BOTÃO
        ========================================= */

        @keyframes giftLaunch {
          0% {
            opacity: 0;
            transform: translate(-50%, 20px) scale(0.4) rotate(-10deg);
          }

          20% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1.1) rotate(5deg);
          }

          45% {
            transform: translate(-50%, -10px) scale(1) rotate(-4deg);
          }

          100% {
            opacity: 0;
            transform: translate(-50%, -90px) scale(0.7) rotate(12deg);
          }
        }

        .animate-gift-launch {
          animation: giftLaunch 700ms cubic-bezier(0.22, 1, 0.36, 1)
            forwards;
        }

        /* =========================================
           COBERTURA DA TELA
        ========================================= */

        @keyframes screenCover {
          0% {
            opacity: 0;
          }

          25% {
            opacity: 1;
          }

          100% {
            opacity: 1;
          }
        }

        .animate-screen-cover {
          animation: screenCover 850ms ease-out forwards;
        }

        /* =========================================
           CÍRCULO
        ========================================= */

        @keyframes transitionCircle {
          0% {
            width: 5rem;
            height: 5rem;
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.5;
          }

          40% {
            width: 5rem;
            height: 5rem;
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }

          100% {
            width: 180vw;
            height: 180vw;
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }

        .animate-transition-circle {
          animation: transitionCircle 850ms
            cubic-bezier(0.76, 0, 0.24, 1) forwards;
        }

        /* =========================================
           PRESENTE CENTRAL
        ========================================= */

        @keyframes transitionGift {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-15deg);
          }

          20% {
            opacity: 1;
            transform: scale(1.15) rotate(5deg);
          }

          45% {
            transform: scale(1) rotate(-3deg);
          }

          70% {
            transform: scale(1.08) rotate(3deg);
          }

          100% {
            opacity: 0;
            transform: scale(0.75) rotate(10deg);
          }
        }

        .animate-transition-gift {
          animation: transitionGift 850ms
            cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* =========================================
           PARTÍCULAS
        ========================================= */

        @keyframes particleOne {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.3);
          }

          25% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate(-70px, -100px) scale(0.5);
          }
        }

        @keyframes particleTwo {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.3);
          }

          25% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate(80px, -90px) scale(0.5);
          }
        }

        @keyframes particleThree {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.3);
          }

          25% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate(-80px, 70px) scale(0.5);
          }
        }

        @keyframes particleFour {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.3);
          }

          25% {
            opacity: 1;
          }

          100% {
            opacity: 0;
            transform: translate(70px, 60px) scale(0.5);
          }
        }

        .animate-particle-one {
          animation: particleOne 800ms ease-out forwards;
        }

        .animate-particle-two {
          animation: particleTwo 800ms ease-out forwards;
        }

        .animate-particle-three {
          animation: particleThree 800ms ease-out forwards;
        }

        .animate-particle-four {
          animation: particleFour 800ms ease-out forwards;
        }

        /* =========================================
           ACESSIBILIDADE
        ========================================= */

        @media (prefers-reduced-motion: reduce) {
          .animate-gift-launch,
          .animate-screen-cover,
          .animate-transition-circle,
          .animate-transition-gift,
          .animate-particle-one,
          .animate-particle-two,
          .animate-particle-three,
          .animate-particle-four {
            animation-duration: 1ms;
          }
        }
      `}</style>
    </>
  );
}