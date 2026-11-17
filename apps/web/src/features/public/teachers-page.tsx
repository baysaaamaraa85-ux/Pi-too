import { Eyebrow } from "@/shared/ui/eyebrow";
import { TEACHERS } from "./content";
import { toCardData, usePublicTeachers, type TeacherCardData } from "./public-api";
import { TeacherCard } from "./teacher-card";

const OTHER = "Бусад";

// Багшийг ажилладаг салбар бүрийн дор харуулна (хэд хэдэн салбарт ажилладаг бол тус бүрд). Салбаргүй бол "Бусад".
function groupByBranch(teachers: TeacherCardData[]) {
  const map = new Map<string, TeacherCardData[]>();
  for (const t of teachers) {
    const branches = t.branch ? t.branch.split(", ") : [OTHER];
    for (const b of branches) map.set(b, [...(map.get(b) ?? []), t]);
  }
  return [...map.entries()].sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b)));
}

export function TeachersPage() {
  const query = usePublicTeachers();
  // DB-д идэвхтэй багш бүртгэгдсэн бол тэднийг, огт байхгүй (шинэ систем) үед л жишээг харуулна.
  const cards = query.data && query.data.length > 0 ? query.data.map(toCardData) : query.isSuccess ? TEACHERS : [];
  const groups = groupByBranch(cards);
  return (
    <section className="px-5 py-14 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <Eyebrow>Багш нар</Eyebrow>
        <h1 className="mb-2 font-display text-[clamp(1.7rem,2.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-foreground">
          Манай багш нар
        </h1>
        <p className="text-sm text-muted">Салбар бүрийн багш нартай танилцана уу.</p>
        {query.isLoading ? <p className="mt-8 text-sm text-muted">Ачаалж байна...</p> : null}
        {query.isError ? (
          <p role="alert" className="mt-8 text-sm font-semibold text-danger">
            Багш нарын жагсаалтыг ачаалж чадсангүй.
          </p>
        ) : null}

        {groups.map(([branch, list]) => (
          <div key={branch} className="mt-10" data-testid="teacher-group">
            <h2 className="mb-5 flex items-center gap-4 text-xs font-bold uppercase tracking-[0.18em] text-muted after:h-px after:flex-1 after:bg-border-warm">
              {branch === OTHER ? OTHER : `${branch} салбар`}
            </h2>
            <ul className="grid gap-5.5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <TeacherCard key={`${branch}-${t.name}`} teacher={t} className="w-auto" />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
