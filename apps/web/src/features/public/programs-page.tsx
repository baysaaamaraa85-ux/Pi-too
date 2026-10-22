import { ArrowRight, BookOpen, Globe, School } from "lucide-react";
import * as React from "react";
import { Link, useLocation } from "react-router";
import { Eyebrow, SectionTitle } from "@/shared/ui/eyebrow";
import { cn } from "@/shared/ui/utils";
import { PROGRAM_SECTIONS } from "./content";

const ICONS = { international: Globe, mongolian: BookOpen, "school-exams": School } as const;

export function ProgramsPage() {
  const { hash } = useLocation();
  const initial = Math.max(
    0,
    PROGRAM_SECTIONS.findIndex((s) => `#${s.id}` === hash),
  );
  const [active, setActive] = React.useState(initial);
  React.useEffect(() => setActive(initial), [initial]);
  const section = PROGRAM_SECTIONS[active]!;

  return (
    <section className="bg-surface px-5 py-14 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <Eyebrow>Хөтөлбөр</Eyebrow>
        <SectionTitle>Таны хүүхдэд тохирсон тусгай хөтөлбөр</SectionTitle>
        <p className="text-sm text-muted">Сурагч бүрт тусгайлсан plan боловсруулж заах болно.</p>

        <ul className="mt-8 flex flex-wrap gap-2.5" role="tablist">
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
                    "inline-flex items-center gap-2 rounded-full border-[1.5px] border-border bg-surface px-5.5 py-2.5 text-[0.8rem] font-semibold text-muted transition hover:border-primary hover:text-primary",
                    index === active && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {s.tabLabel}
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="tabpanel">
          {section.items.map((item) => (
            <li
              key={item.title}
              className="rounded-[10px] border border-transparent bg-background px-5 py-6 transition duration-300 hover:-translate-y-0.75 hover:border-primary/20 hover:bg-surface hover:shadow-soft"
            >
              <h3 className="mb-2 text-[0.92rem] font-bold tracking-tight text-foreground">
                {item.title}
              </h3>
              <p className="text-[0.82rem] leading-[1.7] text-muted">{item.description}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-border pt-8 text-center">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 rounded-[8px] bg-primary px-8 py-3.5 text-[0.85rem] font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Та манай сургалтын төвд суралцмаар байна уу? <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
