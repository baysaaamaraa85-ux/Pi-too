import { TEACHERS } from "./content";
import { Reveal } from "@/shared/pt/motion";
import { PageBody, PageHead, PublicPage } from "./page-kit";
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
    <PublicPage>
      <PageHead
        eyebrow="Багш нар"
        title={
          <>
            Манай <span className="text-brand-700">багш нар</span>
          </>
        }
        text="Салбар бүрийн багш нартай танилцана уу."
      />
      <PageBody className="mt-6">
        {query.isLoading ? <p className="mt-8 text-center text-sm text-ink-500">Ачаалж байна...</p> : null}
        {query.isError ? (
          <p role="alert" className="mt-8 text-center text-sm font-semibold text-danger">
            Багш нарын жагсаалтыг ачаалж чадсангүй.
          </p>
        ) : null}

        {groups.map(([branch, list]) => (
          <section key={branch} className="mt-12" data-testid="teacher-group">
            <Reveal>
              <h2 className="mb-6 flex items-center gap-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-700 after:h-px after:flex-1 after:bg-ink-900/10">
                {branch === OTHER ? OTHER : `${branch} салбар`}
              </h2>
            </Reveal>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <TeacherCard key={`${branch}-${t.name}`} teacher={t} className="w-auto" />
              ))}
            </ul>
          </section>
        ))}
      </PageBody>
    </PublicPage>
  );
}
