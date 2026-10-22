import { Phone } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";
import { SITE } from "./content";

const NAV = [
  { to: "/", label: "Нүүр", end: true },
  { to: "/programs", label: "Хөтөлбөр" },
  { to: "/teachers", label: "Багш нар" },
];

export function PublicNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-40 flex h-15 items-center justify-between border-b border-border bg-[rgba(249,246,242,0.96)] px-5 backdrop-blur-md lg:px-12">
      <Logo />
      <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "text-[0.78rem] font-medium text-muted transition-colors hover:text-primary",
                  isActive && "text-primary",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4">
        <a
          href={`tel:+976${SITE.phone}`}
          className="hidden items-center gap-1.5 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-[0.76rem] font-semibold text-primary transition-colors hover:bg-primary/10 sm:flex"
        >
          <Phone className="size-3.5" />
          Бидэнтэй шууд холбогдох
        </a>
        <Link
          to="/login"
          className="hidden text-[0.78rem] font-semibold text-foreground hover:text-primary sm:block"
        >
          Нэвтрэх
        </Link>
        <Link
          to="/contact"
          className="rounded-2xl bg-primary px-5 py-2 text-[0.78rem] font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Бүртгүүлэх
        </Link>
      </div>
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-[#0f0a04] px-6 py-12 text-center text-white/35">
      <strong className="mb-2.5 block font-display text-2xl font-extrabold tracking-tight text-white">
        <span className="text-primary">π</span> {SITE.brand}
      </strong>
      <p className="text-sm">
        Математикийн бүх төрлийн сургалт • 2–12 анги • {SITE.phone} • {SITE.email}
      </p>
      <small className="mt-5 block text-[0.68rem] opacity-30">© 2026 {SITE.brand}</small>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="pt-15">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
