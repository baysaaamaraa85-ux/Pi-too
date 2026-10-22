import { ArrowRight, BookOpen, Check, Globe, School } from "lucide-react";
import { Link } from "react-router";
import { Eyebrow, SectionTitle } from "@/shared/ui/eyebrow";
import {
  HERO_BENEFITS,
  PACKAGES,
  PROGRAM_SECTIONS,
  REVIEWS,
  STATS,
  STEPS,
  TEACHERS,
} from "./content";
import { TeacherCard } from "./teacher-card";

const PROGRAM_ICONS = {
  international: Globe,
  mongolian: BookOpen,
  "school-exams": School,
} as const;

function reviewInitial(name: string) {
  const match = /[А-ЯӨҮ]/.exec(name);
  return match ? match[0] : name.charAt(0);
}

function Hero() {
  return (
    <header className="flex flex-col bg-background">
      <div className="grid border-b border-border lg:min-h-[calc(100vh-60px-88px)] lg:grid-cols-[1.4fr_1fr]">
        <aside className="relative flex min-w-0 flex-col items-start justify-center gap-5 overflow-hidden border-border px-7 py-13 max-lg:min-h-80 lg:border-r">
          <figure
            className="absolute inset-0 z-1 m-0 max-lg:left-auto max-lg:w-2/3"
            style={{
              WebkitMaskImage:
                "linear-gradient(100deg, transparent 0%, transparent 20%, black 50%)",
              maskImage: "linear-gradient(100deg, transparent 0%, transparent 20%, black 50%)",
            }}
          >
            <img
              src="/images/hero-photo.jpg"
              alt="Сурагчид багштайгаа хамт"
              className="size-full object-cover"
            />
          </figure>
          <p className="relative z-2 border-t-[1.5px] border-primary pt-2 text-[10px] font-bold uppercase tracking-[4px] text-primary">
            Premium Mathematics
          </p>
          <h1 className="relative z-2 font-display text-[clamp(1.55rem,2.1vw,2.3rem)] font-black leading-[1.12] tracking-[-0.04em] text-foreground">
            Хүүхэд бүрт
            <br />
            <span className="text-primary">тусгайлан</span>
            <br />
            хөтөлбөртэй
            <br />
            математик
            <br />
            сургалт
          </h1>
          <p className="relative z-2 text-[12.5px] leading-[1.9] text-muted">
            2–12 ангийн сурагчдад зориулсан
            <br />
            <strong className="font-bold text-foreground">personal plan</strong> дээр суурилсан
            сургалт
          </p>
        </aside>

        <section className="flex flex-col justify-between bg-surface px-6 py-9 lg:px-11 lg:pb-9 lg:pt-11">
          <div>
            <p className="mb-2.5 text-[9px] font-bold uppercase tracking-[3px] text-primary">
              Яагаад "Пи тоо" гэж үү...
            </p>
            <h2 className="mb-5 font-display text-[clamp(1.3rem,2vw,1.8rem)] font-extrabold leading-tight tracking-[-0.04em] text-foreground">
              Манайх танд дараах <em className="not-italic text-primary">давуу талуудыг</em> амлаж
              байна
            </h2>
          </div>
          <div className="flex-1 rounded-2xl border border-border bg-background p-6">
            <span className="mb-4 inline-block rounded bg-primary px-3 py-1.5 text-[9px] font-bold uppercase tracking-[2px] text-primary-foreground">
              75 цагийн багц хөтөлбөр
            </span>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {PACKAGES.map((p) => (
                <div key={p.name} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                  <p className="text-[0.7rem] font-semibold text-muted">{p.name}</p>
                  <p className="font-display text-base font-extrabold text-primary">{p.price}</p>
                </div>
              ))}
            </div>
            <ul className="mb-5">
              {HERO_BENEFITS.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 border-b border-border py-2.5 text-xs font-medium leading-normal text-mid last:border-b-0"
                >
                  <Check className="mt-0.5 size-3 shrink-0 text-primary" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/contact"
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-primary p-3.5 text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Бүртгүүлэх <ArrowRight className="size-4" />
            </Link>
            <a
              href="#programs"
              className="mt-2 block rounded-2xl border-[1.5px] border-border p-2.5 text-center text-[11px] font-medium text-muted"
            >
              Илүүг мэдмээр байна уу?
            </a>
          </div>
        </section>
      </div>

      <ul className="grid grid-cols-2 items-center bg-primary lg:grid-cols-4">
        {STATS.map((s) => (
          <li
            key={s.value}
            className="flex flex-col items-center gap-1 border-white/10 px-4 py-6 lg:border-l lg:first:border-l-0"
          >
            <span
              className={
                s.small
                  ? "font-display text-base font-extrabold tracking-tight text-white"
                  : "font-display text-[26px] font-black leading-none tracking-[-1.5px] text-white"
              }
            >
              {s.value}
            </span>
            {s.label ? (
              <span className="text-[9px] font-semibold uppercase tracking-[2px] text-white/45">
                {s.label}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </header>
  );
}

function Programs() {
  return (
    <section id="programs" className="bg-surface px-5 py-14 lg:px-13 lg:py-22">
      <div className="mx-auto max-w-270">
        <Eyebrow>Хөтөлбөр</Eyebrow>
        <SectionTitle>Математикийн бүх төрлийн хөтөлбөр</SectionTitle>
        <p className="max-w-120 text-sm leading-[1.8] text-muted">
          Бид бүх төрлийн хөтөлбөрийг мэргэжлийн түвшинд үр дүн амалж заадаг ба өдөр бүр элсэлт авч
          байна.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {PROGRAM_SECTIONS.map((section) => {
            const Icon = PROGRAM_ICONS[section.id];
            return (
              <Link
                key={section.id}
                to={`/programs#${section.id}`}
                className="group block rounded-xl border border-transparent bg-background p-6 transition duration-300 hover:-translate-y-0.75 hover:border-primary/20 hover:bg-surface hover:shadow-md"
              >
                <span className="mb-5 grid size-11 place-items-center rounded-lg bg-primary/9 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-display text-[1.05rem] font-extrabold tracking-tight text-foreground">
                      {section.teaserTitle}
                    </h3>
                    <p className="text-[0.78rem] leading-normal text-muted">{section.preview}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.75" />
                </div>
              </Link>
            );
          })}
        </div>
        <Link
          to="/programs"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-primary/15 bg-primary/6 px-6 py-3 text-[0.82rem] font-bold text-primary transition-colors hover:bg-primary/10"
        >
          Хөтөлбөрүүдийг үзэх <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

function Teachers() {
  const loop = [...TEACHERS, ...TEACHERS];
  return (
    <section className="bg-surface px-5 py-14 lg:px-13 lg:py-22">
      <div className="mx-auto max-w-270">
        <header className="mb-9 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Багш нар</Eyebrow>
            <SectionTitle>Манай багш нар</SectionTitle>
            <p className="max-w-120 text-sm leading-[1.8] text-muted">
              Олон жилийн туршлагатай, бэлтгэгдсэн багш нартай танилцана уу
            </p>
          </div>
          <Link
            to="/teachers"
            className="flex shrink-0 items-center gap-1.5 text-[0.83rem] font-semibold text-primary hover:underline"
          >
            Бүгдийг харах <ArrowRight className="size-4" />
          </Link>
        </header>
        <div className="mt-2 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
          <ul className="animate-marquee m-0 flex w-max list-none gap-5.5 p-0 hover:[animation-play-state:paused]">
            {loop.map((t, i) => (
              <TeacherCard key={`${t.name}-${i}`} teacher={t} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section className="bg-background px-5 py-14 lg:px-13 lg:py-22">
      <div className="mx-auto max-w-270">
        <Eyebrow>Эцэг эхчүүдийн сэтгэгдэл</Eyebrow>
        <SectionTitle>Тэд юу гэж хэлэв?</SectionTitle>
        <ul className="mt-9 grid gap-4.5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <li
              key={r.author}
              className="rounded-[10px] border border-border bg-surface px-5.5 py-6.5"
            >
              <span className="mb-2.5 block font-display text-4xl leading-none text-primary opacity-30">
                “
              </span>
              <p className="mb-4.5 text-[0.85rem] leading-[1.78] text-mid">{r.text}</p>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-primary/8 text-[0.7rem] font-extrabold text-primary">
                  {reviewInitial(r.author)}
                </span>
                <div>
                  <span className="block text-[0.82rem] font-bold text-foreground">{r.author}</span>
                  <span className="text-[0.68rem] text-muted">{r.role}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="bg-surface px-5 py-14 lg:px-13 lg:py-22">
      <div className="mx-auto max-w-270">
        <Eyebrow>Хэрхэн ажилладаг</Eyebrow>
        <SectionTitle>3 алхмаар бүртгүүлээрэй</SectionTitle>
        <p className="max-w-120 text-sm leading-[1.8] text-muted">
          Та холбогдох мэдээллээ үлдээхэд л болно. Бид тантай холбогдъё.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const body = (
              <>
                <span className="pointer-events-none absolute -top-2.5 right-3 font-display text-[5rem] font-black leading-none text-primary/9">
                  {index + 1}
                </span>
                <span className="mb-6 grid size-11.5 place-items-center rounded-lg bg-primary/9 font-display text-lg font-extrabold text-primary">
                  {index + 1}
                </span>
                <h3 className="mb-2 font-display text-base font-extrabold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="text-[0.83rem] leading-[1.7] text-muted">{step.description}</p>
              </>
            );
            const cls =
              "relative block overflow-hidden rounded-[10px] border border-transparent bg-background px-6 py-7 transition duration-300";
            return step.to ? (
              <Link
                key={step.title}
                to={step.to}
                className={`${cls} hover:-translate-y-0.75 hover:border-primary/20 hover:bg-surface hover:shadow-md`}
              >
                {body}
              </Link>
            ) : (
              <div key={step.title} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <Programs />
      <hr className="mx-auto max-w-270 border-0 border-t border-border" />
      <Teachers />
      <Reviews />
      <Steps />
    </>
  );
}
