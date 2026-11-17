import { ChevronDown, Info, MapPin, Menu, Phone, X } from "lucide-react";
import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";
import { SITE } from "./content";

// Нийтийн сайтын цэс: анхны загвар (commit ff9e779): лого, төвд 3 холбоос, баруунд холбоо барих, нэвтрэх, бүртгүүлэх.
// "Бидний тухай", "Салбарууд" нь "Манай төв" гэсэн нэг гарчгийн доор, дарахад доош цувирах жагсаалт (AboutMenu).
// Утсанд хамбургер цэс (ФБШ-10), холбоос бүр 44px өндөртэй (харагдах байдал өөрчлөгдөхгүй).
const NAV = [
  { to: "/", label: "Нүүр", end: true },
  { to: "/programs", label: "Хөтөлбөр" },
  { to: "/teachers", label: "Багш нар" },
];

const ABOUT_LABEL = "Манай төв";
const ABOUT_ITEMS = [
  { to: "/about", label: "Бидний тухай", text: "Түүх, багш нар, арга барил", icon: Info },
  { to: "/branches", label: "Салбарууд", text: "Хаяг, холбоо барих утас", icon: MapPin },
];

// Нэг гарчигтай цувирдаг цэс (disclosure): дарж нээнэ, гадна дарах, Escape, Tab-аар гарахад хаагдана.
// Escape дарахад фокус товч руу буцна (гараар ажиллахад хэрэгтэй).
function AboutMenu() {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLLIElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const active = ABOUT_ITEMS.some((i) => i.to === pathname);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <li
      ref={wrapRef}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="about-menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-h-11 cursor-pointer items-center gap-1 text-[0.78rem] font-medium text-foreground transition-colors hover:text-primary",
          (open || active) && "text-primary",
        )}
      >
        {ABOUT_LABEL}
        <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id="about-menu"
          className="animate-dropdown absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2 rounded-2xl border border-border bg-surface p-1.5 shadow-lg motion-reduce:animate-none"
        >
          {ABOUT_ITEMS.map(({ to, label, text, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-background",
                    isActive && "bg-primary/6",
                  )
                }
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/9 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.82rem] font-semibold text-foreground">{label}</span>
                  <span className="block text-xs text-muted">{text}</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PublicNav() {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();
  // Хуудас солигдоход утасны цэс хаагдана.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-40 border-b border-border bg-[rgba(249,246,242,0.96)] backdrop-blur-md"
      aria-label="Нийтийн цэс"
    >
      <div className="flex h-15 items-center justify-between px-5 lg:px-12">
        <Logo />
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex min-h-11 items-center text-[0.78rem] font-medium text-foreground transition-colors hover:text-primary",
                    isActive && "text-primary",
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
          <AboutMenu />
        </ul>
        <div className="flex items-center gap-4">
          <a
            href={`tel:+976${SITE.phone}`}
            className="hidden items-center gap-1.5 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-[0.76rem] font-semibold text-primary transition-colors hover:bg-primary/10 xl:flex"
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
          <button
            type="button"
            className="grid size-11 place-items-center rounded-xl text-foreground-strong hover:bg-primary/8 md:hidden"
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
        <div id="mobile-menu" className="border-t border-border bg-surface px-5 py-3 md:hidden">
          <ul className="grid">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn("flex min-h-12 items-center border-b border-border text-base font-semibold text-mid", isActive && "text-primary")
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <p className="pt-3 text-xs font-bold uppercase tracking-[0.2em] text-muted">{ABOUT_LABEL}</p>
              <ul>
                {ABOUT_ITEMS.map(({ to, label }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      className={({ isActive }) =>
                        cn("flex min-h-12 items-center border-b border-border pl-3 text-base font-semibold text-mid", isActive && "text-primary")
                      }
                    >
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
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

// `classic-type`: нийтийн сайтын гарчгийн фонт (index.css), самбарын фонтод нөлөөлөхгүй.
export function PublicLayout() {
  useHashScroll();
  return (
    <div className="classic-type min-h-screen bg-background">
      <PublicNav />
      <main className="pt-15">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
