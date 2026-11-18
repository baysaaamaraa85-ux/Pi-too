import { ArrowDown, ArrowRight } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { GRADES_RANGE } from "./benefits";

// Нүүрний хамгийн дээд хэсэг (pi_too_home.html): том гарчиг үг бүрээр тодорч, хоёр товч. Тоо, дүрмийн утга энд байхгүй.
// Гарчгийн мөрүүд: "*" тэмдэглэсэн үг улаан, доогуур нь шар шугам.

const HEADLINE: { text: string; accent?: boolean }[][] = [
  [{ text: "Хүүхэд" }, { text: "бүрт" }],
  [{ text: "тусгайлан", accent: true }, { text: "хөтөлбөртэй" }],
  [{ text: "математик" }, { text: "сургалт" }],
];

// Хөвөх математик тэмдэг (чимэг): [тэмдэг, класс, анимацийн хоцрогдол]
const GLYPHS: [string, string, string][] = [
  ["∑", "hidden sm:block text-[120px] left-[6%] top-[120px]", "0s"],
  ["√x", "hidden sm:block text-[90px] right-[8%] top-[160px]", "-4s"],
  ["∫", "hidden md:block text-[70px] left-[16%] top-[380px]", "-8s"],
  ["x²", "hidden md:block text-[80px] right-[17%] top-[400px]", "-2s"],
];

function Headline() {
  let n = 0; // үг бүр 0.08 секундийн дараа тодорно
  return (
    <h1 className="relative mx-auto mt-6 max-w-[1000px] text-[40px] font-semibold leading-none pt-tight sm:text-[62px] lg:text-[78px]">
      {HEADLINE.map((line) => (
        <span key={line[0]!.text} className="block">
          {line.map((word, i) => {
            const style = { animationDelay: `${(0.15 + 0.08 * n++).toFixed(2)}s` };
            return (
              <React.Fragment key={word.text}>
                <span className={word.accent ? "pt-word text-brand-700" : "pt-word"} style={style}>
                  {word.accent ? (
                    <span className="relative">
                      {word.text}
                      <svg
                        className="absolute -bottom-1 left-0 w-full sm:-bottom-2"
                        viewBox="0 0 200 12"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path d="M3 9C60 3 140 2 197 6" stroke="#F2AE3A" strokeWidth="4" strokeLinecap="round" fill="none" />
                      </svg>
                    </span>
                  ) : (
                    word.text
                  )}
                </span>
                {i < line.length - 1 ? " " : null}
              </React.Fragment>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

export function Hero() {
  return (
    <section className="relative px-4 pt-32 text-center sm:pt-36">
      {GLYPHS.map(([glyph, cls, delay]) => (
        <span key={glyph} className={`pt-glyph ${cls}`} style={{ animationDelay: delay }} aria-hidden="true">
          {glyph}
        </span>
      ))}

      <p
        className="pt-word pt-glass h-8 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[12px] font-semibold tracking-[0.14em] text-brand-700"
        style={{ animationDelay: "0.05s", display: "inline-flex" }}
      >
        <span className="grid h-5 place-items-center rounded-full bg-brand-700 px-2 text-[10.5px] tracking-normal text-white">
          {GRADES_RANGE}
        </span>
        PREMIUM MATHEMATICS
      </p>

      <Headline />

      <p className="pt-word mx-auto mt-6 max-w-[560px] text-[16px] text-ink-500 sm:text-[18px]" style={{ animationDelay: "0.9s", display: "block" }}>
        2–12 ангийн сурагчдад зориулсан <span className="font-semibold text-ink-900">personal plan</span> дээр суурилсан сургалт
      </p>

      <div className="pt-word mt-8 flex-wrap items-center justify-center gap-2.5" style={{ animationDelay: "1.05s", display: "flex" }}>
        <Link
          to="/contact"
          className="group inline-flex h-[52px] items-center gap-3 rounded-full bg-brand-700 pl-6 pr-2 text-[15px] font-medium text-white shadow-[0_16px_36px_-12px_rgba(139,26,26,0.7)] transition hover:bg-brand-800"
        >
          Бүртгүүлэх
          <span className="grid size-9 place-items-center rounded-full bg-white/15 transition group-hover:translate-x-0.5">
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
        <a
          href="#programs"
          className="pt-glass inline-flex h-[52px] items-center gap-2 rounded-full px-6 text-[15px] font-medium text-ink-800 transition hover:bg-white"
        >
          Илүүг мэдмээр байна уу? <ArrowDown className="size-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
