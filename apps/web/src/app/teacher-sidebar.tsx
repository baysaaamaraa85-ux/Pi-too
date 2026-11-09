import { KeyRound, LogOut, type LucideIcon } from "lucide-react";
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

      <div className="m-4 rounded-2xl border border-border-warm bg-background-soft p-3.5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-hover font-display text-lg font-bold text-primary-foreground"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground-strong" data-testid="sidebar-name">
              {name || "Багш"}
            </p>
            <p className="text-xs text-muted">Багш</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NavLink
            to="/change-password"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border-warm bg-surface text-xs font-semibold text-mid transition-colors hover:bg-primary/6"
          >
            <KeyRound className="size-4" />
            Нууц үг
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border-warm bg-surface text-xs font-semibold text-primary transition-colors hover:bg-primary/6"
          >
            <LogOut className="size-4" />
            Гарах
          </button>
        </div>
      </div>
    </aside>
  );
}
