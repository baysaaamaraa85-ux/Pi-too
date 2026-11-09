import { Link } from "react-router";
import { cn } from "./utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-black text-primary-foreground",
        className,
      )}
    >
      π
    </span>
  );
}

export function Logo({ to = "/", label = "Пи тоо" }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="flex min-h-11 items-center gap-2.5 no-underline">
      <LogoMark />
      <span className="font-display text-base font-bold tracking-tight text-foreground-strong">
        {label}
      </span>
    </Link>
  );
}
