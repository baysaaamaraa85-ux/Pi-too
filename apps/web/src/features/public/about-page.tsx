import { ArrowRight } from "lucide-react";
import type * as React from "react";
import { Link } from "react-router";
import { ABOUT } from "./content";
import { Reveal } from "@/shared/pt/motion";
import { PageBody, PageHead, PublicPage } from "./page-kit";
import { usePublicOverview, usePublicTeachers } from "./public-api";

function Stat({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <li className={`border-b border-white/15 p-6 sm:p-8 lg:border-b-0 ${last ? "" : "border-r"}`}>
      <strong className="pt-tight pt-num block text-[44px] font-semibold leading-none sm:text-[56px]">{value}</strong>
      <span className="mt-3 block text-[13px] font-medium text-white/70">{label}</span>
    </li>
  );
}

// Үйл ажиллагааны 4 алхмын өнгө (нүүрний картуудтай ижил)
const STYLES = [
  { hue: "139,26,26", tint: "#F6E9E9" },
  { hue: "242,174,58", tint: "#F8F0E2" },
  { hue: "181,72,72", tint: "#F7ECEC" },
  { hue: "76,194,126", tint: "#EAF5EE" },
] as const;

// "Бидний тухай": үүсэл, одоогийн бүтэц (багш, салбар), ажиллах арга, байгууллагын зураг. Тоонууд DB-ээс.
export function AboutPage() {
  const overview = usePublicOverview().data;
  const teachers = usePublicTeachers().data;
  const fill = (text: string) =>
    text.replace("{capacity}", String(overview?.classCapacity ?? "цөөн")).replace("{hours}", String(overview?.packageHours ?? ""));

  return (
    <PublicPage>
      <PageHead
        eyebrow="Бидний тухай"
        title={
          <>
            Сурагч бүрт <span className="text-brand-700">тохирсон</span> математикийн сургалт
          </>
        }
      />
      <PageBody className="mt-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <Reveal>
            <div className="grid gap-4 text-[16px] leading-[1.8] text-ink-700" data-testid="about-origin">
              {ABOUT.origin.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <p data-testid="about-today">
                Одоо манай төвд {teachers && teachers.length > 0 ? `${teachers.length} багш` : "багш нар"}
                {overview ? `, ${overview.branchCount} салбарт` : ""} 2–12 ангийн сурагчдад математикийн хичээл заадаг.
                Багш бүр өөрийн ангид цөөн сурагчтай ажиллаж, сурагч бүрийн түвшин, хурдад тохирсон хувийн төлөвлөгөөгөөр
                заана.
              </p>
            </div>
          </Reveal>
          <Reveal className="relative" delay={80}>
            <div
              className="pointer-events-none absolute -inset-6 rounded-[48px]"
              style={{ background: "radial-gradient(50% 50% at 50% 50%,rgba(139,26,26,.18),transparent 70%)", filter: "blur(28px)" }}
              aria-hidden="true"
            />
            <figure className="relative m-0 overflow-hidden rounded-[30px] border border-ink-900/[.07] shadow-[0_40px_80px_-40px_rgba(23,23,23,0.45)]">
              <img src={ABOUT.photo} alt={ABOUT.photoAlt} className="aspect-[4/3] size-full object-cover" />
            </figure>
          </Reveal>
        </div>

        <Reveal className="relative mt-14 overflow-hidden rounded-[34px] bg-brand-700 text-white">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 120% at 10% 0%,rgba(242,174,58,.25),transparent 60%),radial-gradient(50% 120% at 90% 100%,rgba(23,23,23,.45),transparent 60%)",
            }}
          />
          <div className="pt-noise" />
          <ul className="relative grid grid-cols-2 lg:grid-cols-4" data-testid="about-stats">
            <Stat value={teachers ? String(teachers.length) : "–"} label="Багш" />
            <Stat value={overview ? String(overview.branchCount) : "–"} label="Салбар" />
            <Stat value={overview ? String(overview.classCapacity) : "–"} label="Сурагч / 1 багш" />
            <Stat value={overview ? String(overview.packageHours) : "–"} label="Цагийн багц" last />
          </ul>
        </Reveal>

        <section className="mt-20">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-700">Хэрхэн үйл ажиллагаа явуулдаг вэ</p>
          </Reveal>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT.howWeWork.map((item, i) => {
              const style = STYLES[i % STYLES.length]!;
              return (
                <Reveal
                  key={item.title}
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
                      className="pt-tight pt-num relative text-[44px] font-semibold leading-none text-white transition-transform duration-500 group-hover:scale-110"
                      style={{ textShadow: `0 0 30px rgba(${style.hue},.9)` }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                  </div>
                  <div className="pt-meta flex-1 px-5 py-4">
                    <h3 className="text-[16px] font-semibold leading-snug">{item.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-[1.65] text-ink-500">{fill(item.text)}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/branches"
              className="pt-glass inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14px] font-medium text-brand-700 transition hover:bg-white"
            >
              Салбарууд <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-6 text-[14px] font-medium text-white shadow-[0_10px_24px_-10px_rgba(139,26,26,0.7)] transition hover:bg-brand-800"
            >
              Бүртгүүлэх <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </PageBody>
    </PublicPage>
  );
}
