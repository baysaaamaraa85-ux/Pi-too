import { ChevronDown, KeyRound, LogOut, type LucideIcon } from "lucide-react";
import * as React from "react";
import { NavLink } from "react-router";
import { Logo } from "@/shared/ui/logo";
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

// Хэрэглэгчийн карт: нэр, үүрэг, дарвал нууц үг солих, гарах цэс.
export function UserCard({ name, roleLabel, onLogout }: { name: string; roleLabel: string; onLogout: () => void }) {
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
        className="flex w-full items-center gap-3 rounded-2xl border border-border-warm bg-white/70 p-3 text-left transition-colors hover:bg-white"
      >
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent via-primary to-primary-hover font-display text-lg font-bold text-primary-foreground ring-2 ring-white"
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-foreground-strong" data-testid="sidebar-name">
            {name || roleLabel}
          </span>
          <span className="block text-xs text-muted">{roleLabel}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
    </div>
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
}: {
  items: NavItem[];
  ariaLabel: string;
  logoTo: string;
  logoLabel: string;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-warm bg-white/85 backdrop-blur-md md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo to={logoTo} label={logoLabel} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <SidebarNav items={items} ariaLabel={ariaLabel} />
      </div>
      <div className="p-3">
        <UserCard name={userName} roleLabel={roleLabel} onLogout={onLogout} />
      </div>
    </aside>
  );
}
