import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/shared/ui/logo";

// Нэвтрэх, нууц үг сэргээх хуудсуудын нийтлэг бүтэц (хуучин сайтын login хуудас).
export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border-warm bg-white/90 px-5 backdrop-blur-md sm:px-10">
        <Logo />
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[0.85rem] font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Нүүр хуудас
        </Link>
      </header>
      <main className="grid min-h-[calc(100vh-64px)] place-items-center bg-gradient-to-b from-white to-background px-5 pb-14 pt-12">
        <div className="animate-fade-up w-full max-w-102 min-w-0">
          <p className="mb-2.5 text-center text-xs font-bold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
          <h1 className="mb-2 text-center font-display text-[clamp(1.9rem,2.4vw,2.3rem)] font-bold text-foreground-strong">
            {title}
          </h1>
          <p className="mb-6.5 text-center text-sm leading-relaxed text-muted">{subtitle}</p>
          <div className="grid gap-4.5 rounded-2xl border border-border-warm bg-surface p-7 shadow-lg max-sm:p-5">
            {children}
          </div>
          {footer ? <div className="mt-4.5 text-center text-sm text-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
