import { ArrowRight, BookOpen, Check, Globe, Info, MapPin, School } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { formatMoney } from "@/shared/format/money";
import { Eyebrow, SectionTitle } from "@/shared/ui/eyebrow";
import { PROGRAM_SECTIONS, REVIEWS, STEPS, TEACHERS, TRACK_PROGRAM_NAME } from "./content";
import {
  toCardData,
  usePublicOverview,
  usePublicPrograms,
  usePublicTeachers,
  type PublicOverview,
} from "./public-api";
import { TeacherCard } from "./teacher-card";
import { TrackPrice } from "./track-price";

// UI шүүмжлэл (D-71) ба шийдэл:
// 1. Хуучин загварт бичвэр 9-11px байсан (уншихад хэцүү, ФБШ-10). Одоо хамгийн бага 12px, үндсэн бичвэр 14-16px.
// 2. Гарчиг 5 мөрөнд албадан таслагдаж жижиг (1.55rem) байсан. Одоо том (clamp 2-3.4rem), 3 мөр.
// 3. Үнэ, тоо кодонд тогтсон байсан (ФБШ-29). Одоо өгөгдлийн сангаас (хөтөлбөр, багц, салбар, багшийн тоо).
// 4. Багш нар автоматаар гүйдэг (marquee) байсан: хөдөлгөөнд мэдрэмтгий хүнд бэрхшээлтэй, давхардсан агуулга.
//    Одоо гараар гүйлгэдэг (scroll-snap) жагсаалт, хөдөлгөөнгүй.
// 5. Хоёрдогч үйлдэл 11px саарал бичвэр байсан. Одоо тодорхой нэг үндсэн (Бүртгүүлэх) ба нэг хоёрдогч товч.
// 6. Хэсгүүдийн дэвсгэр хоорондоо ялгагдахгүй (бүгд цагаан) байсан. Одоо хэсэг бүр ээлжлэн өөр дэвсгэртэй.

const PROGRAM_ICONS = {
  international: Globe,
  mongolian: BookOpen,
  "school-exams": School,
} as const;

function reviewInitial(name: string) {
  const match = /[А-ЯӨҮ]/.exec(name);
  return match ? match[0] : name.charAt(0);
}

// Давуу талууд: тоонууд журмын тохиргооноос (settings). Ачаалж чадаагүй бол тоогүй ерөнхий өгүүлбэр.
function benefits(o: PublicOverview | undefined): string[] {
  return [
    o ? `Нэг багшид 2–${o.classCapacity} сурагч` : "Нэг багшид цөөн сурагч",
    "Сурагч бүрт зориулсан тусгай төлөвлөгөө",
    "Хуваарийг сурагч өөрөө сонгоно",
    o ? `${o.leaves} удаа чөлөө авах эрх, бүтэн цагийн нөхөн хичээл` : "Чөлөө авах эрх, бүтэн цагийн нөхөн хичээл",
    o
      ? `Багцын шалгалтанд ${o.reviewThresholdPercent} хувиас доош авбал үнэ төлбөргүй нэмэлт давтлага өгнө`
      : "Багцын шалгалтын дүн бага бол үнэ төлбөргүй нэмэлт давтлага өгнө",
  ];
}

const primaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[0.95rem] font-bold text-primary-foreground transition-colors hover:bg-primary-hover";

function Hero() {
  const overview = usePublicOverview().data;
  const programs = usePublicPrograms().data ?? [];
  // Багцын үнэ: хоёр үндсэн хөтөлбөр (өгөгдлийн сангаас), эхэнд нь олон улсын, дараа нь монгол.
  const tiles = [TRACK_PROGRAM_NAME.international, TRACK_PROGRAM_NAME.mongolian]
    .map((name) => programs.find((p) => p.name === name))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  return (
    <header className="flex flex-col bg-background">
      <div className="grid lg:min-h-[calc(100vh-64px-96px)] lg:grid-cols-[1.25fr_1fr]">
        {/* Зүүн: гарчиг. Зураг баруун талдаа уусч, бичвэр бүрэн тод дэвсгэр дээр. */}
        <div className="relative flex min-w-0 items-center overflow-hidden px-6 py-14 sm:px-10 lg:px-14 lg:py-20">
          <figure
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 m-0 hidden w-[58%] lg:block"
            style={{
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 55%)",
              maskImage: "linear-gradient(90deg, transparent 0%, black 55%)",
            }}
          >
            <img src="/images/hero-photo.jpg" alt="" className="size-full object-cover object-center opacity-90" />
          </figure>

          <div className="relative z-10 flex max-w-xl flex-col items-start gap-6">
            <p className="rounded-full border border-primary/25 bg-surface px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Premium Mathematics
            </p>
            <h1 className="font-display text-[clamp(2.1rem,4vw,3.4rem)] font-black leading-[1.08] tracking-[-0.03em] text-foreground-strong">
              Хүүхэд бүрт <span className="text-primary">тусгайлан</span> хөтөлбөртэй математикийн сургалт
            </h1>
            <p className="max-w-md text-base leading-relaxed text-mid">
              2–12 ангийн сурагчдад зориулсан <strong className="font-bold text-foreground">personal plan</strong> дээр
              суурилсан сургалт.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to="/contact" className={primaryBtn}>
                Бүртгүүлэх <ArrowRight className="size-4" />
              </Link>
              <Link to="/about" className="inline-flex min-h-12 items-center gap-2 text-[0.95rem] font-bold text-foreground-strong hover:text-primary">
                Бидний тухай <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Баруун: багцын карт. */}
        <section aria-labelledby="hero-card-title" className="flex items-center bg-surface px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full rounded-3xl border border-border bg-background p-6 shadow-md sm:p-8">
            <span
              id="hero-card-title"
              className="mb-5 inline-block rounded-md bg-primary px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-primary-foreground"
            >
              {overview ? `${overview.packageHours} цагийн багц хөтөлбөр` : "Багц хөтөлбөр"}
            </span>
            {tiles.length > 0 ? (
              <div className="mb-5 grid grid-cols-2 gap-3">
                {tiles.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-surface px-4 py-3" data-testid="hero-price">
                    <p className="text-xs font-semibold text-muted">{p.name}</p>
                    <p className="font-display text-lg font-extrabold text-primary">{formatMoney(p.price)}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <ul className="mb-6 grid gap-3">
              {benefits(overview).map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-snug text-foreground">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/contact" className={`${primaryBtn} w-full`}>
              Бүртгүүлэх <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/programs"
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-primary/30 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Хөтөлбөрүүдтэй танилцах
            </Link>
          </div>
        </section>
      </div>

      <ul className="grid grid-cols-2 bg-primary text-primary-foreground lg:grid-cols-4">
        <StatCell>
          <strong className="font-display text-2xl font-bold">{overview ? overview.branchCount : "–"} Салбар</strong>
        </StatCell>
        <StatCell>
          <strong className="font-display text-2xl font-bold leading-none">{overview ? overview.classCapacity : "–"}</strong>
          <span className="block text-xs text-white/80">Хүүхэд / 1 багш</span>
        </StatCell>
        <StatCell>
          <strong className="font-display text-base font-bold leading-tight sm:text-lg">Тусгайлан төлөвлөгөө</strong>
        </StatCell>
        <StatCell>
          <strong className="font-display text-base font-bold leading-tight sm:text-lg">Цагаа өөрөө сонгох</strong>
        </StatCell>
      </ul>
    </header>
  );
}

function StatCell({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex min-h-24 flex-col items-center justify-center gap-1 border-white/15 px-4 py-5 text-center max-lg:nth-[n+3]:border-t max-lg:even:border-l lg:border-l lg:first:border-l-0">
      {children}
    </li>
  );
}

function Programs() {
  return (
    <section id="programs" className="bg-surface px-5 py-16 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <Eyebrow>Хөтөлбөр</Eyebrow>
        <SectionTitle>Математикийн бүх төрлийн хөтөлбөр</SectionTitle>
        <p className="max-w-xl text-sm leading-[1.8] text-muted">
          Бид бүх төрлийн хөтөлбөрийг мэргэжлийн түвшинд үр дүн амалж заадаг ба өдөр бүр элсэлт авч байна.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {PROGRAM_SECTIONS.map((section) => {
            const Icon = PROGRAM_ICONS[section.id];
            return (
              <Link
                key={section.id}
                to={`/programs#${section.id}`}
                className="group flex flex-col rounded-2xl border border-border bg-background p-6 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span className="mb-5 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground">{section.teaserTitle}</h3>
                <p className="mt-1.5 text-sm leading-normal text-muted">{section.preview}</p>
                <TrackPrice sectionId={section.id} className="mt-3 text-sm" />
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Дэлгэрэнгүй <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Багш нар: гараар гүйлгэдэг (хөдөлгөөнгүй) жагсаалт. Идэвхтэй багш DB-д огт байхгүй (шинэ систем) үед л жишээ.
function Teachers() {
  const teachers = usePublicTeachers();
  const cards = teachers.data && teachers.data.length > 0 ? teachers.data.map(toCardData) : teachers.isSuccess ? TEACHERS : [];
  return (
    <section id="teachers" className="bg-background px-5 py-16 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Багш нар</Eyebrow>
            <SectionTitle>Манай багш нар</SectionTitle>
            <p className="max-w-xl text-sm leading-[1.8] text-muted">Олон жилийн туршлагатай, бэлтгэгдсэн багш нартай танилцана уу</p>
          </div>
          <Link to="/teachers" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            Бүгдийг харах <ArrowRight className="size-4" />
          </Link>
        </header>
        <ul
          className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 lg:mx-0 lg:px-0"
          data-testid="home-teachers"
          aria-label="Багш нар"
        >
          {cards.map((t, i) => (
            <TeacherCard key={`${t.name}-${i}`} teacher={t} className="snap-start" />
          ))}
        </ul>
      </div>
    </section>
  );
}

// "Бидний тухай", "Салбарууд" тусдаа хуудас руу: нүүр хуудсыг товч байлгана.
function Explore() {
  const overview = usePublicOverview().data;
  const items = [
    { to: "/about", icon: Info, title: "Бидний тухай", text: "Байгууллагын түүх, багш нар, сургалтын арга барил" },
    {
      to: "/branches",
      icon: MapPin,
      title: "Салбарууд",
      text: overview ? `${overview.branchCount} салбарын хаяг, холбоо барих утас` : "Салбар бүрийн хаяг, холбоо барих утас",
    },
  ];
  return (
    <section className="bg-surface px-5 py-16 lg:px-13 lg:py-20" data-testid="home-explore">
      <div className="mx-auto grid max-w-270 gap-5 md:grid-cols-2">
        {items.map(({ to, icon: Icon, title, text }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-5 rounded-2xl border border-border bg-background p-6 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-extrabold tracking-tight text-foreground">{title}</span>
              <span className="block text-sm leading-snug text-muted">{text}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section className="bg-background px-5 py-16 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <Eyebrow>Эцэг эхчүүдийн сэтгэгдэл</Eyebrow>
        <SectionTitle>Тэд юу гэж хэлэв?</SectionTitle>
        <ul className="mt-9 grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <li key={r.author} className="rounded-2xl border border-border bg-surface px-6 py-7">
              <span className="mb-2 block font-display text-4xl leading-none text-primary opacity-30">“</span>
              <p className="mb-5 text-sm leading-[1.75] text-mid">{r.text}</p>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
                  {reviewInitial(r.author)}
                </span>
                <div>
                  <span className="block text-sm font-bold text-foreground">{r.author}</span>
                  <span className="text-xs text-muted">{r.role}</span>
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
    <section className="bg-surface px-5 py-16 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <Eyebrow>Хэрхэн ажилладаг</Eyebrow>
        <SectionTitle>3 алхмаар бүртгүүлээрэй</SectionTitle>
        <p className="max-w-xl text-sm leading-[1.8] text-muted">Та холбогдох мэдээллээ үлдээхэд л болно. Бид тантай холбогдъё.</p>
        <ol className="mt-9 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const body = (
              <>
                <span className="mb-5 grid size-11 place-items-center rounded-xl bg-primary/10 font-display text-lg font-extrabold text-primary">
                  {index + 1}
                </span>
                <h3 className="mb-2 font-display text-base font-extrabold tracking-tight text-foreground">{step.title}</h3>
                <p className="text-sm leading-[1.7] text-muted">{step.description}</p>
              </>
            );
            const cls = "block h-full rounded-2xl border border-border bg-background px-6 py-7 transition duration-300";
            return (
              <li key={step.title}>
                {step.to ? (
                  <Link to={step.to} className={`${cls} hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md`}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <Programs />
      <Teachers />
      <Explore />
      <Reviews />
      <Steps />
    </>
  );
}
