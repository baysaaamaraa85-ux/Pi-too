import { ArrowRight, ArrowUpRight, BookOpen, Globe, School } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { PROGRAM_SECTIONS } from "../content";
import { IconTile } from "@/shared/pt/icon-tile";
import { Reveal } from "@/shared/pt/motion";
import { SectionHead } from "./section-head";

// Хөтөлбөрийн хэсэг: өмнөх бичвэр, 3 ангилал, "Хөтөлбөрүүдийг үзэх" холбоос хэвээр. Үнэ энд харагдахгүй (D-74), "Хөтөлбөр" хуудсанд.
// Загвар нь давуу талын картын нэгэн адил: харанхуй гэрэлтдэг cover, доор бүдэг өнгөт хэсэг.
const STYLES = {
  international: { icon: Globe, hue: "242,174,58", tint: "#F8F0E2" },
  mongolian: { icon: BookOpen, hue: "139,26,26", tint: "#F6E9E9" },
  "school-exams": { icon: School, hue: "76,194,126", tint: "#EAF5EE" },
} as const;

export function ProgramsSection() {
  return (
    <section id="programs" className="mt-20 scroll-mt-24 sm:mt-28">
      <SectionHead
        eyebrow="Хөтөлбөр"
        title={
          <>
            Математикийн <span className="text-brand-700">бүх төрлийн</span> хөтөлбөр
          </>
        }
        text="Бид бүх төрлийн хөтөлбөрийг мэргэжлийн түвшинд үр дүн амалж заадаг ба өдөр бүр элсэлт авч байна."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {PROGRAM_SECTIONS.map((section, i) => {
          const style = STYLES[section.id];
          return (
            <Reveal key={section.id} delay={i * 60} className="pt-lib group" style={{ "--tint": style.tint } as React.CSSProperties}>
              <Link to={`/programs#${section.id}`} className="flex h-full flex-col">
                <div className="pt-cover pt-dark grid h-[140px] place-items-center">
                  <div className="pt-glow" style={{ background: `radial-gradient(40% 50% at 50% 55%,rgba(${style.hue},.55),transparent 70%)` }} />
                  <div className="pt-dots" />
                  <div className="pt-noise" />
                  <IconTile icon={style.icon} hue={style.hue} />
                  <span className="pt-num absolute left-3 top-3 grid h-6 place-items-center rounded-full border border-white/10 bg-white/10 px-2 text-[11px] font-semibold text-white/70">
                    0{i + 1}
                  </span>
                </div>
                <div className="pt-meta flex flex-1 items-start justify-between gap-4 px-5 py-4">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[17px] font-semibold leading-snug">{section.teaserTitle}</h3>
                    <p className="text-[13.5px] leading-normal text-ink-500">{section.preview}</p>
                  </div>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-brand-700 shadow-sm transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
      <Link
        to="/programs"
        className="pt-glass mt-5 inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14px] font-medium text-brand-700 transition hover:bg-white"
      >
        Хөтөлбөрүүдийг үзэх <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
