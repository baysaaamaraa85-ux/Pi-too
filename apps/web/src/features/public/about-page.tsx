import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Eyebrow } from "@/shared/ui/eyebrow";
import { ABOUT } from "./content";
import { usePublicOverview, usePublicTeachers } from "./public-api";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className="rounded-2xl border border-border bg-surface px-5 py-4">
      <strong className="block font-display text-3xl font-extrabold leading-none text-primary tabular-nums">{value}</strong>
      <span className="mt-1.5 block text-[0.8rem] text-muted">{label}</span>
    </li>
  );
}

// "Бидний тухай": үүсэл, одоогийн бүтэц (багш, салбар), ажиллах арга, байгууллагын зураг. Тоонууд DB-ээс.
export function AboutPage() {
  const overview = usePublicOverview().data;
  const teachers = usePublicTeachers().data;
  const fill = (text: string) =>
    text.replace("{capacity}", String(overview?.classCapacity ?? "цөөн")).replace("{hours}", String(overview?.packageHours ?? ""));

  return (
    <>
      <section className="bg-background px-5 py-14 lg:px-13 lg:py-20">
        <div className="mx-auto grid max-w-270 items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <Eyebrow>Бидний тухай</Eyebrow>
            <h1 className="mb-4 font-display text-[clamp(1.8rem,2.8vw,2.6rem)] font-extrabold leading-tight tracking-[-0.03em] text-foreground">
              Сурагч бүрт тохирсон математикийн сургалт
            </h1>
            <div className="grid gap-3.5 text-[0.95rem] leading-[1.85] text-mid" data-testid="about-origin">
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
            <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="about-stats">
              <Stat value={teachers ? String(teachers.length) : "–"} label="Багш" />
              <Stat value={overview ? String(overview.branchCount) : "–"} label="Салбар" />
              <Stat value={overview ? String(overview.classCapacity) : "–"} label="Сурагч / 1 багш" />
              <Stat value={overview ? String(overview.packageHours) : "–"} label="Цагийн багц" />
            </ul>
          </div>
          <figure className="m-0 overflow-hidden rounded-[1.75rem] shadow-lg">
            <img src={ABOUT.photo} alt={ABOUT.photoAlt} className="aspect-[4/3] size-full object-cover" />
          </figure>
        </div>
      </section>

      <section className="bg-surface px-5 py-14 lg:px-13 lg:py-20">
        <div className="mx-auto max-w-270">
          <Eyebrow>Хэрхэн үйл ажиллагаа явуулдаг вэ</Eyebrow>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT.howWeWork.map((item, i) => (
              <li key={item.title} className="rounded-[10px] bg-background px-5 py-6">
                <span className="mb-4 grid size-10 place-items-center rounded-lg bg-primary/9 font-display text-base font-extrabold text-primary">
                  {i + 1}
                </span>
                <h3 className="mb-1.5 font-display text-[0.98rem] font-extrabold tracking-tight text-foreground">{item.title}</h3>
                <p className="text-[0.83rem] leading-[1.7] text-muted">{fill(item.text)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/branches"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border-[1.5px] border-primary/30 px-6 text-[0.85rem] font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Салбарууд <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-[0.85rem] font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Бүртгүүлэх <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
