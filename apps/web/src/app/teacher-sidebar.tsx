import { ChevronDown, KeyRound, LogOut, type LucideIcon } from "lucide-react";
import * as React from "react";
import { NavLink } from "react-router";
import { useTeacherDashboard } from "@/features/dashboard/dashboard-api";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// Багшийн компьютерийн хажуугийн цэс: бичвэртэй цэс, доор нь багшийн карт. Утсанд доод цэс ашиглана.
export function TeacherSidebar({ items, onLogout }: { items: Item[]; onLogout: () => void }) {
  const dash = useTeacherDashboard();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);
  const name = dash.data?.teacherName ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "Б";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-warm bg-white/85 backdrop-blur-md md:flex">
      <div className="flex h-20 items-center px-6">
        <Logo to="/teacher" label="Багш" />
      </div>

      <nav aria-label="Багшийн цэс" className="grid flex-1 content-start gap-1.5 px-4 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-[0.95rem] font-semibold text-mid transition-all hover:bg-primary/6 hover:text-primary",
                isActive && "bg-primary text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground",
              )
            }
          >
            <item.icon className="size-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="relative m-4" ref={menuRef}>
        {menuOpen ? (
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
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border-warm bg-white/70 p-3 text-left transition-colors hover:bg-white"
        >
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent via-primary to-primary-hover font-display text-xl font-bold text-primary-foreground ring-2 ring-white"
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-foreground-strong" data-testid="sidebar-name">
              {name || "Багш"}
            </span>
            <span className="block text-xs text-muted">Багш</span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", menuOpen && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}
