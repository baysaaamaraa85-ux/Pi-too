import { cn } from "@/shared/ui/utils";
import type { TeacherCardData } from "./public-api";

function initial(name: string) {
  const match = /[А-ЯӨҮA-Z]/.exec(name);
  return match ? match[0] : name.charAt(0);
}

// Нүүр, багш нарын хуудсанд ижил харагдах багшийн карт.
export function TeacherCard({
  teacher,
  className,
}: {
  teacher: TeacherCardData;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex w-70 shrink-0 flex-col overflow-hidden rounded-[10px] border border-primary/20 bg-surface shadow-[0_8px_24px_rgba(139,26,26,0.1)] transition duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_16px_40px_rgba(139,26,26,0.16)]",
        className,
      )}
    >
      <div className="relative flex h-32 items-end justify-center overflow-hidden bg-gradient-to-br from-primary/12 via-[#f6dccd] to-accent/25">
        {teacher.photo ? null : (
          <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-7xl font-black text-primary/15">
            {initial(teacher.name)}
          </span>
        )}
        {teacher.photo ? (
          <img
            src={teacher.photo}
            alt={teacher.name}
            loading="lazy"
            className="absolute inset-0 size-full object-cover object-[center_20%]"
          />
        ) : null}
        <span className="absolute -bottom-6 grid size-13 place-items-center rounded-full border-[3px] border-surface bg-[#f2dede] font-display text-lg font-extrabold text-primary">
          {initial(teacher.name)}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-9">
        <h3 className="mb-2 font-display text-[0.95rem] font-extrabold tracking-tight text-foreground">
          {teacher.name}
        </h3>
        <div className="mb-1 flex flex-wrap gap-1.5">
          {teacher.specialties.map((s) => (
            <span
              key={s}
              className="rounded-full bg-[#f3ece3] px-2.5 py-0.5 text-[0.7rem] font-semibold text-[#5a4a42]"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}
