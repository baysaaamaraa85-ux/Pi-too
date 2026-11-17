import { cn } from "./utils";

// Бага үсгийн тэмдэглэгээ ба улаан зураас: хуучин сайтын ".sec-lbl".
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mb-2 inline-flex items-center text-xs font-bold uppercase tracking-[0.22em] text-primary before:mr-3 before:inline-block before:h-0.5 before:w-6.5 before:bg-primary",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "mb-2.5 font-display text-[clamp(1.5rem,2.8vw,2.2rem)] font-extrabold leading-[1.15] tracking-[-0.03em] text-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}
