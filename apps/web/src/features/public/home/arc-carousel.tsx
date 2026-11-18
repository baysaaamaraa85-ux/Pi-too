import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Globe, School, Users } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { cn } from "@/shared/ui/utils";
import { PROGRAM_SECTIONS } from "../content";
import type { PublicOverview } from "../public-api";
import { benefitTexts, GRADES_RANGE, packageLabel } from "./benefits";
import { useWindowWidth } from "@/shared/pt/use-motion";

// 3D нум хэлбэрийн карусель (pi_too_home.html): гурван карт. Гол карт нь 75 цагийн багц.
// Сум товч, цэг, гар дээрх зүүн/баруун сум, утсанд шудрах хөдөлгөөнөөр солигдоно. Тоонууд журмын тохиргооноос (ФБШ-29).

type CardProps = { overview: PublicOverview | undefined; active: boolean };

// Дотор нь байгаа холбоос идэвхгүй (харагдаж буй хажуугийн) картанд Tab-аар орохгүй.
const tab = (active: boolean) => (active ? 0 : -1);

function PhotoCard({ overview }: { overview: PublicOverview | undefined }) {
  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="relative flex-1 overflow-hidden">
        <img
          src="/images/hero-card.jpg"
          alt="Хичээл дээр сурч буй сурагчид"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: "38% 28%" }}
          draggable={false}
        />
        <span className="pt-glass absolute left-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-ink-800">
          <span className="size-1.5 rounded-full bg-brand-700" />
          {GRADES_RANGE}
        </span>
      </div>
      <div className="px-6 py-5" style={{ background: "linear-gradient(180deg,#F6E9E9,#fff)" }}>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-paper-3 bg-white px-3 text-[11.5px] font-semibold">
            <Users className="size-3.5 text-brand-700" aria-hidden="true" />
            {overview ? `Нэг багш 2–${overview.classCapacity} сурагч` : "Нэг багшид цөөн сурагч"}
          </span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-700 px-3 text-[11.5px] font-semibold text-white">
            <span className="size-1.5 rounded-full bg-gold-300" />
            Personal plan
          </span>
        </div>
        <div className="pt-tight mt-3 text-[24px] font-semibold leading-tight">Хүүхэд бүрт тусгайлан хөтөлбөр</div>
        <div className="mt-1 text-[13.5px] text-ink-500">2–12 ангийн сурагчдад зориулсан</div>
      </div>
    </div>
  );
}

function PackageCard({ overview, active }: CardProps) {
  return (
    <div className="pt-dark relative flex h-full flex-col overflow-hidden bg-[#141110] p-6 text-white sm:p-7">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 45% at 80% 0%,rgba(139,26,26,.85),transparent 70%),radial-gradient(50% 35% at 0% 100%,rgba(242,174,58,.2),transparent 70%)",
        }}
      />
      <div className="pt-dots" />
      <div className="pt-noise" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="inline-flex h-7 items-center rounded-full bg-brand-700 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] ring-1 ring-white/15">
          {packageLabel(overview)}
        </span>
        <span className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/10 font-semibold text-gold-300" aria-hidden="true">
          π
        </span>
      </div>
      <div className="relative mt-5 flex items-end gap-3">
        <span className="pt-tight pt-num text-[84px] font-semibold leading-[.8]" style={{ textShadow: "0 0 40px rgba(242,174,58,.35)" }}>
          {overview ? overview.packageHours : "–"}
        </span>
        <span className="pb-1 leading-tight">
          <span className="block text-[20px] font-semibold">цаг</span>
          <span className="block text-[12.5px] text-white/55">багц хөтөлбөр</span>
        </span>
      </div>
      <ul className="relative mt-6 space-y-3">
        {benefitTexts(overview).map((text) => (
          <li key={text} className="flex items-start gap-3 text-[15px] leading-snug text-white/90">
            <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-gold-400 text-ink-900">
              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <div className="relative mt-auto grid gap-2 pt-5">
        <Link
          to="/contact"
          tabIndex={tab(active)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-700 text-[14.5px] font-semibold shadow-[0_14px_30px_-10px_rgba(139,26,26,0.9)] ring-1 ring-white/15 transition hover:bg-brand-600"
        >
          Бүртгүүлэх <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <a
          href="#programs"
          tabIndex={tab(active)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 text-[13.5px] font-medium transition hover:bg-white/10"
        >
          Илүүг мэдмээр байна уу?
        </a>
      </div>
    </div>
  );
}

// Гурав дахь карт: хөтөлбөрийн төрлүүд (Олон улсын, Монгол, сургуулийн шалгалт). Бичвэр нь content.ts-ийн хөтөлбөрийн хэсгүүдээс.
const PROGRAM_ICONS = { international: Globe, mongolian: BookOpen, "school-exams": School } as const;

function ProgramsCard({ active }: { active: boolean }) {
  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="pt-dark relative flex-1 overflow-hidden bg-[#141110]">
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 60% at 50% 45%,rgba(139,26,26,.55),transparent 70%)" }} />
        <div className="pt-dots" />
        <div className="pt-noise" />
        <span className="absolute left-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-[12px] font-semibold text-white">
          <BookOpen className="size-3.5 text-gold-300" aria-hidden="true" />
          Хөтөлбөрүүд
        </span>
        <ul className="absolute inset-x-4 bottom-4 top-16 flex flex-col justify-center gap-2.5">
          {PROGRAM_SECTIONS.map((p) => {
            const Icon = PROGRAM_ICONS[p.id];
            return (
              <li key={p.id} className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-white">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-gold-300" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-snug">{p.teaserTitle}</span>
                  <span className="block text-[12px] leading-snug text-white/60">{p.preview}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="px-6 py-5" style={{ background: "linear-gradient(180deg,#F6E9E9,#fff)" }}>
        <p className="text-[14px] font-medium leading-snug text-ink-800">
          Олон улсын болон Монгол хөтөлбөр, бүх төрлийн хөтөлбөр, сургуулийн шалгалтуудад бэлтгэнэ.
        </p>
        <Link
          to="/programs"
          tabIndex={tab(active)}
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-700 hover:text-brand-800"
        >
          Хөтөлбөрүүдийг үзэх <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function ArcCarousel({ overview }: { overview: PublicOverview | undefined }) {
  const cards = [
    { label: "Пи тоо сургалт", node: () => <PhotoCard overview={overview} /> },
    { label: packageLabel(overview), node: (active: boolean) => <PackageCard overview={overview} active={active} /> },
    { label: "Хөтөлбөрүүд", node: (active: boolean) => <ProgramsCard active={active} /> },
  ];
  const [index, setIndex] = React.useState(1);
  const width = useWindowWidth();
  const swipeStart = React.useRef<number | null>(null);
  const swiped = React.useRef(false);

  const mobile = width < 768;
  const cw = mobile ? Math.min(340, width - 56) : width < 1180 ? 340 : 390;
  const ch = mobile ? 560 : 570;
  const gap = mobile ? cw * 0.92 : cw * 1.04;

  const go = (i: number) => setIndex(Math.max(0, Math.min(cards.length - 1, i)));

  return (
    <section
      className="relative -my-8 mt-12 overflow-x-clip py-8 sm:mt-16"
      aria-label="Пи тоо товчоор"
      aria-roledescription="carousel"
    >
      <div className="pt-horizon" aria-hidden="true" />
      <div
        className="pt-arc-stage relative mx-auto max-w-[1440px]"
        style={{ "--cw": `${cw}px`, "--ch": `${ch}px`, height: ch } as React.CSSProperties}
        tabIndex={0}
        aria-label="Карусель. Сум товчоор шилжинэ."
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
              key={i}
              className="pt-arc-card"
              data-active={active}
              role="group"
              aria-roledescription="slide"
              aria-label={card.label}
              aria-hidden={mobile && !active ? true : undefined}
              onClick={() => {
                if (!active && !swiped.current) go(i);
              }}
              style={{
                transform: `translateX(${k * gap}px) translateZ(${-a * (mobile ? 140 : 90)}px) rotateY(${-k * (mobile ? 18 : 10)}deg)`,
                zIndex: 10 - a,
                filter: mobile && a ? "brightness(.92)" : "none",
                opacity: a >= 2 ? 0 : 1,
              }}
            >
              <div className="pt-face">{card.node(active)}</div>
            </div>
          );
        })}
        <div className="pt-arc-edge" />
      </div>

      <p className="sr-only" aria-live="polite">
        {`${index + 1} / ${cards.length}: ${cards[index]!.label}`}
      </p>
      <div className="relative z-10 mt-8 flex items-center justify-center gap-3">
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
            // Товчны талбай 24px (WCAG 2.5.8), харагдах цэг нь жижиг.
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={card.label}
              aria-current={i === index}
              className="grid h-6 min-w-6 place-items-center"
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
