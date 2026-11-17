import { formatMoney } from "@/shared/format/money";
import { cn } from "@/shared/ui/utils";
import { TRACK_PROGRAM_NAME, type ProgramSection } from "./content";
import { usePublicOverview, usePublicPrograms } from "./public-api";

// Ангиллын гарчиг дээрх жижиг үнэ: "1 800 000 ₮ · 75 цагийн багц". Үнэ ба цаг DB-ээс (ФШ-08, ФБШ-29).
// Тухайн ангилалд үнэтэй хөтөлбөр байхгүй бол (жишээ нь сургуулийн шалгалт) юу ч харуулахгүй.
export function TrackPrice({ sectionId, className }: { sectionId: ProgramSection["id"]; className?: string }) {
  const programs = usePublicPrograms().data;
  const overview = usePublicOverview().data;
  const name = TRACK_PROGRAM_NAME[sectionId];
  const program = name ? programs?.find((p) => p.name === name) : undefined;
  if (!program) return null;
  return (
    <p className={cn("text-[0.8rem] font-semibold text-primary", className)} data-testid="track-price">
      {formatMoney(program.price)}
      {overview ? ` · ${overview.packageHours} цагийн багц` : ""}
    </p>
  );
}
