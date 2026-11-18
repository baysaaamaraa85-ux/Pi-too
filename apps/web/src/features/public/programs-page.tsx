import { ArrowRight, BookOpen, Globe, School } from "lucide-react";
import * as React from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@/shared/ui/utils";
import { PROGRAM_SECTIONS } from "./content";
import { Reveal } from "@/shared/pt/motion";
import { PageBody, PageHead, PublicPage } from "./page-kit";
import { TrackPrice } from "./track-price";

const ICONS = { international: Globe, mongolian: BookOpen, "school-exams": School } as const;

// Ангилал бүрийн гэрэлтэх өнгө, бүдэг дэвсгэр (нүүрний хөтөлбөрийн картуудтай ижил)
const STYLES = {
  international: { hue: "242,174,58", tint: "#F8F0E2" },
  mongolian: { hue: "139,26,26", tint: "#F6E9E9" },
  "school-exams": { hue: "76,194,126", tint: "#EAF5EE" },
} as const;

export function ProgramsPage() {
  const { hash } = useLocation();
  const initial = Math.max(
    0,
    PROGRAM_SECTIONS.findIndex((s) => `#${s.id}` === hash),
  );
  const [active, setActive] = React.useState(initial);
  React.useEffect(() => setActive(initial), [initial]);
  const section = PROGRAM_SECTIONS[active]!;
  const style = STYLES[section.id];

  return (
    <PublicPage>
      <PageHead
        eyebrow="Хөтөлбөр"
        title={
          <>
            Таны хүүхдэд <span className="text-brand-700">тохирсон тусгай</span> хөтөлбөр
          </>
        }
        text="Сурагч бүрт тусгайлсан plan боловсруулж заах болно."
      />
      <PageBody className="mt-10">
        <ul className="flex flex-wrap justify-center gap-2.5" role="tablist">
          {PROGRAM_SECTIONS.map((s, index) => {
            const Icon = ICONS[s.id];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  onClick={() => setActive(index)}
                  className={cn(
                    "inline-flex h-12 items-center gap-2 rounded-full px-5 text-[14px] font-medium transition",
                    index === active
                      ? "bg-brand-700 text-white shadow-[0_10px_24px_-10px_rgba(139,26,26,0.7)]"
                      : "pt-glass text-ink-700 hover:bg-white",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {s.tabLabel}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="pt-tight text-[26px] font-semibold sm:text-[32px]">{section.teaserTitle}</h2>
          <TrackPrice
            sectionId={section.id}
            className="inline-flex h-8 items-center rounded-full bg-brand-50 px-3 text-[13px] font-semibold text-brand-700"
          />
        </div>

        <ul className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="tabpanel">
          {section.items.map((item, i) => (
            <Reveal
              key={`${section.id}-${item.title}`}
              as="li"
              delay={i * 60}
              className="pt-lib group flex flex-col"
              style={{ "--tint": style.tint } as React.CSSProperties}
            >
              <div className="pt-cover pt-dark grid h-[96px] place-items-center">
                <div className="pt-glow" style={{ background: `radial-gradient(40% 50% at 50% 55%,rgba(${style.hue},.55),transparent 70%)` }} />
                <div className="pt-dots" />
                <div className="pt-noise" />
                <span
                  className="pt-tight pt-num relative text-[40px] font-semibold leading-none text-white transition-transform duration-500 group-hover:scale-110"
                  style={{ textShadow: `0 0 30px rgba(${style.hue},.9)` }}
                  aria-hidden="true"
                >
                  0{i + 1}
                </span>
              </div>
              <div className="pt-meta flex-1 px-5 py-4">
                <h3 className="text-[16px] font-semibold leading-snug">{item.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-[1.65] text-ink-500">{item.description}</p>
              </div>
            </Reveal>
          ))}
        </ul>

        <div className="mt-12 text-center">
          <Link
            to="/contact"
            className="inline-flex min-h-[52px] items-center gap-3 rounded-full bg-brand-700 py-2 pl-6 pr-2 text-[15px] font-medium text-white shadow-[0_16px_36px_-12px_rgba(139,26,26,0.7)] transition hover:bg-brand-800"
          >
            Та манай сургалтын төвд суралцмаар байна уу?
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </PageBody>
    </PublicPage>
  );
}
