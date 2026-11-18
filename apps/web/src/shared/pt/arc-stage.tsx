import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { cn } from "@/shared/ui/utils";
import { useWindowWidth } from "./use-motion";

// 3D нум хэлбэрийн карусель (teacher_today_v5.html). Картуудын агуулгыг дуудагч өгнө; идэвхтэй карт `active` авна.
// Сум товч, цэг, гарын зүүн/баруун сум, шудрах хөдөлгөөнөөр солигдоно. Товч бүр 44px (ФБШ-10).

export interface ArcCard {
  key: string;
  label: string;
  // Идэвхтэй картыг дарахад очих хуудас (бүхэл карт холбоос болно)
  to?: string;
  node: (active: boolean) => React.ReactNode;
}

export function ArcStage({ cards, initial = 0, ariaLabel }: { cards: ArcCard[]; initial?: number; ariaLabel: string }) {
  const [index, setIndex] = React.useState(initial);
  const width = useWindowWidth();
  const swipeStart = React.useRef<number | null>(null);
  const swiped = React.useRef(false);

  const small = width < 640;
  const cw = small ? 240 : 280;
  const ch = small ? 300 : 340;
  const gap = small ? cw * 0.78 : Math.min(cw * 1.08, width / 5.2);
  const go = (i: number) => setIndex(Math.max(0, Math.min(cards.length - 1, i)));

  return (
    <section className="relative -my-6 overflow-x-clip py-6" aria-label={ariaLabel} aria-roledescription="carousel">
      <div className="pt-horizon" aria-hidden="true" />
      <div
        className="pt-arc-stage pt-arc-plain relative mx-auto max-w-[1400px]"
        style={{ "--cw": `${cw}px`, "--ch": `${ch}px`, height: ch } as React.CSSProperties}
        tabIndex={0}
        aria-label="Тойм карусель. Сум товчоор шилжинэ."
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(index - 1);
          if (e.key === "ArrowRight") go(index + 1);
        }}
        onPointerDown={(e) => {
          swipeStart.current = e.clientX;
          swiped.current = false;
        }}
        onPointerUp={(e) => {
          if (swipeStart.current === null) return;
          const dx = e.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(dx) > 40) {
            swiped.current = true;
            go(index + (dx < 0 ? 1 : -1));
          }
        }}
      >
        {cards.map((card, i) => {
          const k = i - index;
          const a = Math.abs(k);
          const active = k === 0;
          return (
            <div
              key={card.key}
              className="pt-arc-card"
              data-active={active}
              role="group"
              aria-roledescription="slide"
              aria-label={card.label}
              aria-hidden={active ? undefined : true}
              onClickCapture={(e) => {
                // Шудрах хөдөлгөөний дараах click-ийг (хуудас руу шилжих, карт солих) үл тооно
                if (swiped.current) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onClick={() => {
                if (!active) go(i);
              }}
              style={{
                transform: `translateX(${k * gap}px) translateZ(${-a * a * (small ? 70 : 55) - a * 30}px) rotateY(${-k * (small ? 22 : 16)}deg)`,
                zIndex: 10 - a,
                filter: a >= 2 ? "blur(2px) saturate(.8)" : "none",
                opacity: a >= 3 ? 0 : 1,
              }}
            >
              <div className="pt-face">
                {card.node(active)}
                {active && card.to ? (
                  <Link
                    to={card.to}
                    aria-label={`${card.label}: дэлгэрэнгүй`}
                    className="absolute inset-0 z-10 rounded-[26px] outline-offset-[-4px]"
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="pt-arc-edge" />
      </div>

      <p className="sr-only" aria-live="polite">
        {`${index + 1} / ${cards.length}: ${cards[index]?.label ?? ""}`}
      </p>
      <div className="relative z-10 mt-6 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => go(index - 1)}
          className="pt-glass grid size-11 place-items-center rounded-full hover:bg-white"
          aria-label="Өмнөх"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <div className="flex items-center">
          {cards.map((card, i) => (
            <button
              key={card.key}
              type="button"
              onClick={() => go(i)}
              aria-label={card.label}
              aria-current={i === index}
              className="grid h-11 min-w-8 place-items-center"
            >
              <span className={cn("block h-2 rounded-full transition-all duration-500", i === index ? "w-[22px] bg-brand-700" : "w-2 bg-ink-300")} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          className="pt-glass grid size-11 place-items-center rounded-full hover:bg-white"
          aria-label="Дараах"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
