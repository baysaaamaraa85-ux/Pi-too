import { ArrowUpRight, ChevronDown, Info, MapPin, Menu, Phone, X } from "lucide-react";
import * as React from "react";
import { Link, Outlet, useLocation } from "react-router";
import { cn } from "@/shared/ui/utils";
import { SITE } from "./content";
import "@/shared/pt/pt.css";

// Нийтийн сайтын цэс (D-84, pi_too_home.html): зүүн талд лого, төвд шилэн шахмал цэс (идэвхтэй холбоосыг улаан заагч дагана),
// баруунд холбоо барих, нэвтрэх, бүртгүүлэх. "Бидний тухай", "Салбарууд" нь "Манай төв" гэсэн нэг гарчгийн доор цувирна (AboutMenu).
// Нэг <nav> дотор бүгд байна. Утсанд хамбургер цэс (ФБШ-10), холбоос бүр 44px-аас өндөр.

const NAV = [
  { key: "home", to: "/", label: "Нүүр" },
  { key: "programs", to: "/programs", label: "Хөтөлбөр" },
  { key: "teachers", to: "/teachers", label: "Багш нар" },
] as const;

const ABOUT_KEY = "about";
const ABOUT_LABEL = "Манай төв";
const ABOUT_ITEMS = [
  { to: "/about", label: "Бидний тухай", text: "Түүх, багш нар, арга барил", icon: Info },
  { to: "/branches", label: "Салбарууд", text: "Хаяг, холбоо барих утас", icon: MapPin },
];

// Одоогийн хуудас цэсний аль хэсэгт хамаарах вэ (заагч, идэвхтэй өнгө)
function activeKey(pathname: string): string | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/programs")) return "programs";
  if (pathname.startsWith("/teachers")) return "teachers";
  if (ABOUT_ITEMS.some((i) => pathname.startsWith(i.to))) return ABOUT_KEY;
  return null;
}

const pillText = (active: boolean) =>
  cn(
    "relative z-10 inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-4 text-[13.5px] font-medium transition-colors motion-reduce:transition-none",
    active ? "text-white" : "text-ink-600 hover:text-ink-900",
  );

// Нэг гарчигтай цувирдаг цэс (disclosure): дарж нээнэ, гадна дарах, Escape, Tab-аар гарахад хаагдана.
// Escape дарахад фокус товч руу буцна (гараар ажиллахад хэрэгтэй).
function AboutMenu({ active, itemRef }: { active: boolean; itemRef: (el: HTMLLIElement | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLLIElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

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
      ref={(el) => {
        wrapRef.current = el;
        itemRef(el);
      }}
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
        className={cn(pillText(active), open && !active && "text-brand-700")}
      >
        {ABOUT_LABEL}
        <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id="about-menu"
          className="animate-dropdown absolute left-1/2 top-full z-50 mt-3 w-64 -translate-x-1/2 rounded-[22px] border border-ink-900/10 bg-white/95 p-1.5 shadow-[0_20px_50px_-20px_rgba(23,23,23,0.35)] backdrop-blur-xl motion-reduce:animate-none"
        >
          {ABOUT_ITEMS.map(({ to, label, text, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={() => setOpen(false)}
                aria-current={pathname === to ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-paper-2 aria-[current=page]:bg-brand-50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink-900">{label}</span>
                  <span className="block text-xs text-ink-500">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// Шилэн шахмал цэс: идэвхтэй зүйлийн ард улаан заагч гулсаж очно. Байрлалыг хэмжиж (offsetLeft, offsetWidth) тавина.
function NavPill() {
  const active = activeKey(useLocation().pathname);
  const items = React.useRef<Record<string, HTMLLIElement | null>>({});
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null);
  const [ready, setReady] = React.useState(false);

  const place = React.useCallback(() => {
    const el = active ? items.current[active] : null;
    setBox(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [active]);

  React.useLayoutEffect(() => {
    place();
    window.addEventListener("resize", place);
    // Фонт ачаалагдсны дараа өргөн өөрчлөгддөг тул дахин хэмжинэ.
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  // Анхны байрлалд хөдөлгөөнгүй тавина, дараагийн солигдолд гулсуулна.
  React.useEffect(() => {
    if (!box || ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [box, ready]);

  const setItem = (key: string) => (el: HTMLLIElement | null) => {
    items.current[key] = el;
  };

  return (
    <div className="pt-glass relative hidden rounded-full p-[5px] lg:block">
      <span
        className="pt-ind"
        data-ready={ready && box !== null}
        style={box ? { left: box.left, width: box.width } : undefined}
        aria-hidden="true"
      />
      <ul className="flex items-center">
        {NAV.map((item) => (
          <li key={item.key} ref={setItem(item.key)}>
            <Link to={item.to} aria-current={active === item.key ? "page" : undefined} className={pillText(active === item.key)}>
              {item.label}
            </Link>
          </li>
        ))}
        <AboutMenu active={active === ABOUT_KEY} itemRef={setItem(ABOUT_KEY)} />
      </ul>
    </div>
  );
}

function BrandMark() {
  return (
    <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2.5" aria-label="Пи тоо нүүр">
      <span className="grid size-10 place-items-center rounded-[13px] bg-brand-700 text-lg font-semibold text-white shadow-[0_8px_20px_-8px_rgba(139,26,26,0.7)]">
        π
      </span>
      <span className="pt-tight text-[17px] font-semibold text-ink-900">Пи тоо</span>
    </Link>
  );
}

export function PublicNav() {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();
  const active = activeKey(pathname);
  // Хуудас солигдоход утасны цэс хаагдана.
  React.useEffect(() => setOpen(false), [pathname]);

  const mobileLink = (isActive: boolean) =>
    cn(
      "flex h-12 items-center justify-between rounded-2xl px-4 font-medium",
      isActive ? "bg-brand-700 text-white" : "text-ink-900 hover:bg-white",
    );

  return (
    <nav className="pt-ui fixed inset-x-0 top-0 z-40" aria-label="Нийтийн цэс">
      {/* Гүйлгэхэд лого, товчийн ард контент давхцахаас сэргийлэх зөөлөн бүдгэрүүлэлт (дэвсгэр өнгөтэй ижил) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-paper from-40% to-transparent" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <BrandMark />
        <NavPill />
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`tel:+976${SITE.phone}`}
            className="pt-glass hidden h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-brand-700 transition hover:bg-white md:inline-flex"
          >
            <Phone className="size-4" aria-hidden="true" />
            Бидэнтэй шууд холбогдох
          </a>
          <Link
            to="/login"
            className="hidden h-10 items-center rounded-full px-4 text-[13.5px] font-medium text-ink-700 transition hover:bg-white/70 sm:inline-flex"
          >
            Нэвтрэх
          </Link>
          <Link
            to="/contact"
            className="inline-flex h-10 items-center rounded-full bg-brand-700 px-5 text-[13.5px] font-medium text-white shadow-[0_10px_24px_-10px_rgba(139,26,26,0.7)] transition hover:bg-brand-800"
          >
            Бүртгүүлэх
          </Link>
          <button
            type="button"
            className="pt-glass grid size-11 place-items-center rounded-full lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Цэс хаах" : "Цэс нээх"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-[18px]" aria-hidden="true" /> : <Menu className="size-[18px]" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-menu" className="pt-glass relative mx-4 mt-2 rounded-[24px] p-2 lg:hidden">
          <ul className="grid">
            {NAV.map((item) => (
              <li key={item.key}>
                <Link to={item.to} aria-current={active === item.key ? "page" : undefined} className={mobileLink(active === item.key)}>
                  {item.label}
                  <ArrowUpRight className={cn("size-4", active !== item.key && "text-ink-400")} aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <p className="px-4 pb-1 pt-3 text-[11px] font-semibold tracking-[0.18em] text-ink-500">{ABOUT_LABEL.toUpperCase()}</p>
              <ul>
                {ABOUT_ITEMS.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} aria-current={pathname === to ? "page" : undefined} className={mobileLink(pathname === to)}>
                      {label}
                      <ArrowUpRight className={cn("size-4", pathname !== to && "text-ink-400")} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a
              href={`tel:+976${SITE.phone}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-50 text-[14px] font-medium text-brand-700"
            >
              <Phone className="size-4" aria-hidden="true" />
              Холбогдох
            </a>
            <Link to="/login" className="inline-flex h-12 items-center justify-center rounded-2xl bg-white text-[14px] font-medium">
              Нэвтрэх
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

// Доод хэсэг (pi_too_home.html): цайвар, нэг мөр. Холбоо барих утас, и-мэйл нь өмнөх хувилбараас хэвээр.
export function PublicFooter() {
  return (
    <footer className="pt-ui mx-auto max-w-[1240px] px-4 sm:px-6">
      <div className="mt-16 flex flex-col items-center justify-between gap-4 text-[13px] text-ink-500 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[10px] bg-brand-700 font-semibold text-white" aria-hidden="true">
            π
          </span>
          <span className="font-semibold text-ink-900">{SITE.brand}</span>
          <span className="text-ink-300">·</span>
          Premium Mathematics
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1" aria-label="Доод цэс">
          <Link to="/programs" className="inline-flex min-h-11 items-center hover:text-ink-900">
            Хөтөлбөр
          </Link>
          <Link to="/teachers" className="inline-flex min-h-11 items-center hover:text-ink-900">
            Багш нар
          </Link>
          <Link to="/about" className="inline-flex min-h-11 items-center hover:text-ink-900">
            Бидний тухай
          </Link>
          <Link to="/branches" className="inline-flex min-h-11 items-center hover:text-ink-900">
            Салбарууд
          </Link>
          <Link to="/login" className="inline-flex min-h-11 items-center hover:text-ink-900">
            Нэвтрэх
          </Link>
        </nav>
      </div>
      <p className="pb-10 pt-2 text-center text-xs text-ink-500 sm:text-left">
        <a href={`tel:+976${SITE.phone}`} className="underline-offset-2 hover:underline">
          {SITE.phone}
        </a>{" "}
        · {SITE.email} · © 2026 {SITE.brand}
      </p>
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
// Бүх нийтийн хуудас цэсний доор өөрийн толгойгоор (дээд зайтай) эхэлдэг (page-kit.tsx, home/hero.tsx).
export function PublicLayout() {
  useHashScroll();
  return (
    <div className="classic-type min-h-screen bg-background">
      <PublicNav />
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
