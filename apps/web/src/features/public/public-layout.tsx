import { Menu, Phone, X } from "lucide-react";
import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";
import { SITE } from "./content";

// Нийтийн сайтын цэс (хуучин загвар, сайжруулсан): лого, төвд цэс, баруунд холбоо барих, нэвтрэх, бүртгүүлэх.
// Сайжруулалт: утсанд цэс байхгүй байсан (ФБШ-10) тул хамбургер цэс нэмсэн, бичвэр 14px+, товч 44px+.
const NAV = [
  { to: "/", label: "Нүүр", end: true },
  { to: "/programs", label: "Хөтөлбөр" },
  { to: "/teachers", label: "Багш нар" },
  { to: "/about", label: "Бидний тухай" },
  { to: "/branches", label: "Салбарууд" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-11 items-center border-b-2 border-transparent text-sm font-medium text-mid transition-colors hover:text-primary",
    isActive && "border-primary text-primary",
  );

export function PublicNav() {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();
  // Хуудас солигдоход утасны цэс хаагдана.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <nav className="fixed inset-x-0 top-0 z-40 border-b border-border bg-[rgba(249,246,242,0.96)] backdrop-blur-md" aria-label="Нийтийн цэс">
      <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-12">
        <Logo />
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={linkClass}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href={`tel:+976${SITE.phone}`}
            className="hidden min-h-11 items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 xl:inline-flex"
          >
            <Phone className="size-4" />
            Бидэнтэй холбогдох
          </a>
          <Link to="/login" className="hidden min-h-11 items-center px-1 text-sm font-semibold text-foreground hover:text-primary sm:inline-flex">
            Нэвтрэх
          </Link>
          <Link
            to="/contact"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Бүртгүүлэх
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl text-foreground-strong hover:bg-primary/8 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Цэс хаах" : "Цэс нээх"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-menu" className="border-t border-border bg-surface px-5 py-3 lg:hidden">
          <ul className="grid">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => cn("flex min-h-12 items-center border-b border-border text-base font-semibold text-mid", isActive && "text-primary")}>
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <Link to="/login" className="flex min-h-12 items-center border-b border-border text-base font-semibold text-mid">
                Нэвтрэх
              </Link>
            </li>
            <li>
              <a href={`tel:+976${SITE.phone}`} className="flex min-h-12 items-center gap-2 text-base font-semibold text-primary">
                <Phone className="size-4" />
                {SITE.phone}
              </a>
            </li>
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-[#0f0a04] px-6 py-12 text-center text-white/45">
      <strong className="mb-2.5 block font-display text-2xl font-extrabold tracking-tight text-white">
        <span className="text-primary">π</span> {SITE.brand}
      </strong>
      <p className="text-sm">
        Математикийн бүх төрлийн сургалт • 2–12 анги •{" "}
        <a href={`tel:+976${SITE.phone}`} className="underline-offset-2 hover:underline">
          {SITE.phone}
        </a>{" "}
        • {SITE.email}
      </p>
      <small className="mt-5 block text-xs opacity-50">© 2026 {SITE.brand}</small>
    </footer>
  );
}

// "/programs#international" гэх мэт холбоосоор ирэхэд тухайн хэсэг рүү гүйлгэнэ.
function useHashScroll() {
  const { hash, pathname } = useLocation();
  React.useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, pathname]);
}

export function PublicLayout() {
  useHashScroll();
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="pt-16">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
