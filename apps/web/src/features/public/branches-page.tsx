import { MapPin, Phone } from "lucide-react";
import { Eyebrow } from "@/shared/ui/eyebrow";
import { SITE } from "./content";
import { usePublicBranches } from "./public-api";

// "Салбарууд": салбар бүрийн зураг, хаяг, тайлбар, холбоо барих утас. Бүгд DB-ээс (админ засна).
// Салбарт утас бүртгээгүй бол төвийн ерөнхий утсыг харуулна.
export function BranchesPage() {
  const query = usePublicBranches();
  const branches = query.data ?? [];
  return (
    <section className="bg-background px-5 py-14 lg:px-13 lg:py-20">
      <div className="mx-auto max-w-270">
        <Eyebrow>Салбарууд</Eyebrow>
        <h1 className="mb-2 font-display text-[clamp(1.7rem,2.6vw,2.4rem)] font-extrabold tracking-[-0.03em] text-foreground">
          Танд ойр салбараа сонгоорой
        </h1>
        <p className="text-sm text-muted">Салбар бүрийн хаяг, холбоо барих утас.</p>
        {query.isLoading ? <p className="mt-8 text-sm text-muted">Ачаалж байна...</p> : null}
        {query.isError ? (
          <p role="alert" className="mt-8 text-sm font-semibold text-danger">
            Салбарын жагсаалтыг ачаалж чадсангүй.
          </p>
        ) : null}
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="public-branches">
          {branches.map((b) => {
            const phones = b.phones.length > 0 ? b.phones : [SITE.phone];
            return (
              <li key={b.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm" data-testid="public-branch">
                <div className="relative grid h-44 place-items-center overflow-hidden bg-gradient-to-br from-primary/12 via-[#f6dccd] to-accent/25">
                  {b.photoUrl ? (
                    <img src={b.photoUrl} alt={`${b.name} салбар`} loading="lazy" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <MapPin aria-hidden="true" className="size-12 text-primary/25" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2.5 p-5">
                  <h2 className="font-display text-base font-extrabold text-foreground">{b.name}</h2>
                  <p className="flex items-start gap-2 text-[0.85rem] leading-snug text-mid">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    {b.address}
                  </p>
                  {b.description ? <p className="text-[0.82rem] leading-[1.7] text-muted">{b.description}</p> : null}
                  <ul className="mt-auto grid gap-1 pt-1">
                    {phones.map((phone) => (
                      <li key={phone}>
                        <a
                          href={`tel:${phone.replace(/\s+/g, "")}`}
                          className="inline-flex min-h-9 items-center gap-2 text-[0.88rem] font-semibold text-primary hover:underline"
                        >
                          <Phone className="size-4" />
                          {phone}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
