import * as React from "react";
import { REVIEWS } from "../content";
import { Reveal } from "@/shared/pt/motion";
import { SectionHead } from "./section-head";
import { spotlightMove } from "@/shared/pt/spotlight";

// Эцэг эхчүүдийн сэтгэгдэл: өмнөх бичвэр, нэр, үүрэг хэвээр. Загвар нь бүдэг өнгөт карт, том ишлэлийн тэмдэг, харанхуй дугуй аватар.
const TINTS = ["#F6E9E9", "#F8F0E2", "#EAF5EE"];

function initial(name: string) {
  const match = /[А-ЯӨҮ]/.exec(name);
  return match ? match[0] : name.charAt(0);
}

export function ReviewsSection() {
  return (
    <section className="mt-20 sm:mt-28">
      <SectionHead eyebrow="Эцэг эхчүүдийн сэтгэгдэл" title={<>Тэд юу гэж <span className="text-brand-700">хэлэв?</span></>} />
      <ul className="grid gap-4 md:grid-cols-3">
        {REVIEWS.map((r, i) => (
          <Reveal
            key={r.author}
            as="li"
            delay={i * 60}
            className="pt-lib pt-spot flex flex-col"
            style={{ "--tint": TINTS[i % TINTS.length] } as React.CSSProperties}
            onPointerMove={spotlightMove}
          >
            <div className="pt-meta flex h-full flex-col px-6 py-7">
              <span className="pt-tight block text-[64px] font-semibold leading-[.7] text-brand-300" aria-hidden="true">
                “
              </span>
              <p className="mt-3 flex-1 text-[15px] leading-[1.7] text-ink-700">{r.text}</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-[#141110] text-[15px] font-semibold text-gold-300 ring-2 ring-white">
                  {initial(r.author)}
                </span>
                <div>
                  <span className="block text-[14px] font-semibold">{r.author}</span>
                  <span className="text-[12.5px] text-ink-500">{r.role}</span>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
