import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/shared/ui/utils";
import type { TeacherCardData } from "./public-api";

function initial(name: string) {
  const match = /[А-ЯӨҮA-Z]/.exec(name);
  return match ? match[0] : name.charAt(0);
}

// Нэг картанд харагдах заах чиглэлийн дээд тоо, үлдсэн нь "+N" болно.
const MAX_CHIPS = 4;

// Нүүр, багш нарын хуудсанд ижил харагдах багшийн карт (хэрэглэгчийн үзүүлсэн загвар): дугуй зураг, нэр, салбар,
// доор нь заах чиглэлүүд (шошго). Туршлага, тайлбар мөр байхгүй. Утас, имэйл харуулахгүй (ФШ-78).
// `to` өгвөл карт бүхэлдээ холбоос болж, баруун доод буланд ↗ товч гарна (нүүр хуудсанд "Бүх багш" руу). Багшийн тусдаа хуудас байхгүй.
export function TeacherCard({
  teacher,
  className,
  to,
}: {
  teacher: TeacherCardData;
  className?: string;
  to?: string;
}) {
  const shown = teacher.specialties.slice(0, MAX_CHIPS);
  const rest = teacher.specialties.length - shown.length;
  const hasFooter = shown.length > 0 || to !== undefined;
  return (
    <li
      className={cn(
        "group relative flex w-80 shrink-0 flex-col gap-5 rounded-3xl border border-border bg-surface p-7 transition-colors duration-300",
        to && "hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-center gap-5">
        <div className="shrink-0 rounded-full p-1 ring-1 ring-primary/25">
          <div className="size-18 overflow-hidden rounded-full bg-primary/9">
            {teacher.photo ? (
              <img
                src={teacher.photo}
                alt={teacher.name}
                loading="lazy"
                className="size-full object-cover object-[center_20%]"
              />
            ) : (
              <span aria-hidden="true" className="grid size-full place-items-center font-display text-3xl font-extrabold text-primary">
                {initial(teacher.name)}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-extrabold leading-tight tracking-tight text-foreground">{teacher.name}</h3>
          {teacher.branch ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm leading-snug text-muted">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="line-clamp-2">{teacher.branch}</span>
            </p>
          ) : null}
        </div>
      </div>
      {hasFooter ? (
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-5">
          {shown.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Заах чиглэл">
              {shown.map((s) => (
                <li key={s} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-mid">
                  {s}
                </li>
              ))}
              {rest > 0 ? <li className="rounded-full bg-primary/9 px-3 py-1 text-xs font-semibold text-primary">+{rest}</li> : null}
            </ul>
          ) : null}
          {to ? (
            <Link
              to={to}
              aria-label={`${teacher.name}: бүх багш нарыг харах`}
              className="ml-auto grid size-9 shrink-0 place-items-center rounded-full bg-background text-mid transition-colors duration-200 after:absolute after:inset-0 after:rounded-3xl group-hover:bg-primary group-hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
