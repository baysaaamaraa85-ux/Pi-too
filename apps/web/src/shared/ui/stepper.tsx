import { Check } from "lucide-react";
import { cn } from "./utils";

// Элсэлтийн алхам заагч (design 5.5.2): дууссан алхам нь тэмдэгтэй, одоогийнх тоотой.
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex items-start" aria-label="Алхмууд">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("flex flex-1 flex-col items-center", index > 0 && "relative")}
          >
            {index > 0 ? (
              <span
                className={cn(
                  "absolute right-1/2 top-4.5 h-0.5 w-full bg-border",
                  index <= current && "bg-primary",
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-1 grid size-9 place-items-center rounded-full border-2 border-border bg-surface text-sm font-bold text-muted sm:size-11",
                (done || active) && "border-primary bg-primary text-primary-foreground",
                active && "shadow-[0_0_0_4px_rgba(139,26,26,0.14)]",
              )}
            >
              {done ? <Check className="size-4 sm:size-5" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                "mt-2 text-center text-xs font-semibold text-muted",
                (done || active) && "text-primary",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
