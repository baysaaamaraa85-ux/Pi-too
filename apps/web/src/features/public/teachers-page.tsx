import { Eyebrow } from "@/shared/ui/eyebrow";
import { TEACHERS } from "./content";
import { TeacherCard } from "./teacher-card";

export function TeachersPage() {
  const branches = [...new Set(TEACHERS.map((t) => t.branch))];
  return (
    <section className="px-5 py-14 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <Eyebrow>Багш нар</Eyebrow>
        <h1 className="mb-2 font-display text-[clamp(1.7rem,2.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-foreground">
          Манай багш нар
        </h1>
        <p className="text-sm text-muted">Салбар бүрийн багш нартай танилцана уу.</p>

        {branches.map((branch) => (
          <div key={branch} className="mt-10">
            <h2 className="mb-5 flex items-center gap-4 text-xs font-bold uppercase tracking-[0.18em] text-muted after:h-px after:flex-1 after:bg-border-warm">
              {branch} салбар
            </h2>
            <ul className="grid gap-5.5 sm:grid-cols-2 lg:grid-cols-3">
              {TEACHERS.filter((t) => t.branch === branch).map((t) => (
                <TeacherCard key={t.name} teacher={t} className="w-auto" />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
