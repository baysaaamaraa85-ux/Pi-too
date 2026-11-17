import { cn } from "@/shared/ui/utils";

// Зурагтай бол зураг, үгүй бол нэрийн эхний үсэг. Багшийн профайл, цэс, жагсаалтад нийтлэг.
export function Avatar({
  url,
  name,
  className,
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "π";
  return (
    <span
      className={cn(
        "relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-display text-lg font-bold text-primary-foreground",
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 size-full object-cover object-[center_20%]" />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
