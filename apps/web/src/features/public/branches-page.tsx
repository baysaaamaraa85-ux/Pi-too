import { MapPin, Phone } from "lucide-react";
import type * as React from "react";
import { SITE } from "./content";
import { IconTile } from "@/shared/pt/icon-tile";
import { Reveal } from "@/shared/pt/motion";
import { PageBody, PageHead, PublicPage } from "./page-kit";
import { usePublicBranches } from "./public-api";

// Карт бүрийн бүдэг өнгө (нүүрний картуудтай ижил дараалал)
const TINTS = ["#F6E9E9", "#F8F0E2", "#EAF5EE"];

// "Салбарууд": салбар бүрийн зураг, хаяг, тайлбар, холбоо барих утас. Бүгд DB-ээс (админ засна).
// Салбарт утас бүртгээгүй бол төвийн ерөнхий утсыг харуулна.
export function BranchesPage() {
  const query = usePublicBranches();
  const branches = query.data ?? [];
  return (
    <PublicPage>
      <PageHead
        eyebrow="Салбарууд"
        title={
          <>
            Танд <span className="text-brand-700">ойр салбараа</span> сонгоорой
          </>
        }
        text="Салбар бүрийн хаяг, холбоо барих утас."
      />
      <PageBody className="mt-10">
        {query.isLoading ? <p className="text-center text-sm text-ink-500">Ачаалж байна...</p> : null}
        {query.isError ? (
          <p role="alert" className="text-center text-sm font-semibold text-danger">
            Салбарын жагсаалтыг ачаалж чадсангүй.
          </p>
        ) : null}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="public-branches">
          {branches.map((b, i) => {
            const phones = b.phones.length > 0 ? b.phones : [SITE.phone];
            return (
              <Reveal
                key={b.id}
                as="li"
                delay={(i % 3) * 60}
                className="pt-lib group flex flex-col"
                style={{ "--tint": TINTS[i % TINTS.length] } as React.CSSProperties}
              >
                <div data-testid="public-branch" className="flex h-full flex-col">
                  <div className="pt-cover pt-dark grid h-44 place-items-center">
                    {b.photoUrl ? (
                      <img src={b.photoUrl} alt={`${b.name} салбар`} loading="lazy" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <>
                        <div className="pt-glow" style={{ background: "radial-gradient(40% 50% at 50% 55%,rgba(139,26,26,.55),transparent 70%)" }} />
                        <div className="pt-dots" />
                        <div className="pt-noise" />
                        <IconTile icon={MapPin} hue="139,26,26" />
                      </>
                    )}
                  </div>
                  <div className="pt-meta flex flex-1 flex-col gap-2.5 px-5 py-4">
                    <h2 className="text-[17px] font-semibold leading-snug">{b.name}</h2>
                    <p className="flex items-start gap-2 text-[14px] leading-snug text-ink-700">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                      {b.address}
                    </p>
                    {b.description ? <p className="text-[13.5px] leading-[1.65] text-ink-500">{b.description}</p> : null}
                    <ul className="mt-auto grid gap-1 pt-1">
                      {phones.map((phone) => (
                        <li key={phone}>
                          <a
                            href={`tel:${phone.replace(/\s+/g, "")}`}
                            className="inline-flex min-h-11 items-center gap-2 text-[14.5px] font-semibold text-brand-700 hover:text-brand-800"
                          >
                            <Phone className="size-4" aria-hidden="true" />
                            {phone}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </PageBody>
    </PublicPage>
  );
}
