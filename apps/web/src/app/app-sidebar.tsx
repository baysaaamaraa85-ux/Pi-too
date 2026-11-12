import { ChevronDown, KeyRound, LogOut, type LucideIcon } from "lucide-react";
import * as React from "react";
import { NavLink } from "react-router";
import { cn } from "@/shared/ui/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// Бүх үүргийн хажуугийн цэсний бичвэртэй жагсаалт. Идэвхтэй цэс maroon градиент.
export function SidebarNav({
  items,
  ariaLabel,
  onNavigate,
}: {
  items: NavItem[];
  ariaLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label={ariaLabel} className="grid content-start gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-mid transition-all hover:bg-primary/6 hover:text-primary",
              isActive &&
                "bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-md hover:text-primary-foreground",
            )
          }
        >
          <item.icon className="size-[18px] shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

// Хэрэглэгчийн карт: нэр, үүрэг. menu=true бол дарвал нууц үг солих, гарах цэс гарна.
export function UserCard({
  name,
  roleLabel,
  onLogout,
  menu = true,
}: {
  name: string;
  roleLabel: string;
  onLogout: () => void;
  menu?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const initial = name.trim().charAt(0).toUpperCase() || roleLabel.charAt(0);
  const avatar = (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-hover font-display text-lg font-bold text-primary-foreground ring-2 ring-white"
    >
      {initial}
    </span>
  );
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-foreground-strong" data-testid="sidebar-name">
        {name || roleLabel}
      </span>
      <span className="block truncate text-xs text-muted">{roleLabel}</span>
    </span>
  );

  if (!menu) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border-warm bg-white/80 p-3 shadow-soft">
        {avatar}
        {text}
      </div>
    );
  }
  return (
    <div className="relative" ref={ref}>
      {open ? (
        <div className="absolute bottom-full left-0 right-0 mb-2 grid gap-1 rounded-2xl border border-border-warm bg-white p-2 shadow-lg">
          <NavLink
            to="/change-password"
            className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-mid hover:bg-background-soft"
          >
            <KeyRound className="size-4" />
            Нууц үг солих
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-primary hover:bg-background-soft"
          >
            <LogOut className="size-4" />
            Гарах
          </button>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border-warm bg-white/80 p-3 text-left shadow-soft transition-colors hover:bg-white"
      >
        {avatar}
        {text}
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}

// Лого ба үүрэг: "Пи тоо" доор нь "Админ", "Багш", "Сурагч", "Эцэг эх".
function Brand({ to, sub }: { to: string; sub: string }) {
  return (
    <NavLink to={to} className="flex min-h-12 items-center gap-3 no-underline">
      <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover font-display text-xl font-black text-primary-foreground shadow-md">
        π
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold text-foreground-strong">Пи тоо</span>
        <span className="block text-xs font-semibold text-muted">{sub}</span>
      </span>
    </NavLink>
  );
}

// Компьютерийн хажуугийн цэс (md+): лого, цэс, доор хэрэглэгчийн карт. Утсанд доод цэс эсвэл drawer.
export function AppSidebar({
  items,
  ariaLabel,
  logoTo,
  logoLabel,
  userName,
  roleLabel,
  onLogout,
  passwordLink = false,
}: {
  items: NavItem[];
  ariaLabel: string;
  logoTo: string;
  logoLabel: string;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
  // true бол карт цэсгүй, түүний дээр "Нууц үг солих" холбоос (сурагч, эцэг эх).
  passwordLink?: boolean;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-warm bg-white/85 backdrop-blur-md md:flex">
      <div className="px-5 pb-3 pt-4">
        <Brand to={logoTo} sub={logoLabel} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <SidebarNav items={items} ariaLabel={ariaLabel} />
      </div>
      <div className="grid gap-2 p-3">
        {passwordLink ? (
          <NavLink
            to="/change-password"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-mid transition-colors hover:bg-primary/6 hover:text-primary"
          >
            <KeyRound className="size-[18px]" />
            Нууц үг солих
          </NavLink>
        ) : null}
        <UserCard name={userName} roleLabel={roleLabel} onLogout={onLogout} menu={!passwordLink} />
      </div>
    </aside>
  );
}
