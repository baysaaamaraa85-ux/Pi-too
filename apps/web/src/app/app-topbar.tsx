import { Bell } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";

// Сануулгын хонх (багш, админ, эцэг эхийн бүрхүүлд нийтлэг). Нэр нь түүхэн: өмнө нь дээд мөр, хайлт эндээс гарч байсан.

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

export interface BellItem {
  key: string;
  to: string;
  title: string;
  detail?: string;
}

// Хонх: сануулга байвал улаан цэг, дарвал жагсаалт.
// glass: багшийн самбарын шилэн цэсний загвар (44px дугуй товч, шилэн жагсаалт).
export function ReminderBell({ items, glass = false }: { items: BellItem[]; glass?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  const count = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={count > 0 ? `Сануулга: ${count}` : "Сануулга"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          glass
            ? "pt-glass relative grid size-11 place-items-center rounded-full text-ink-600 transition-colors hover:bg-white hover:text-ink-900"
            : "relative grid size-11 place-items-center rounded-full border border-border-warm bg-white/80 text-primary shadow-soft transition-colors hover:bg-white"
        }
        data-testid="reminder-bell"
      >
        <Bell className={glass ? "size-[18px]" : "size-[22px]"} />
        {count > 0 ? (
          <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-danger ring-2 ring-white" data-testid="bell-dot" />
        ) : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Сануулга" className={
            glass
              ? "absolute right-0 top-14 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-[22px] border border-ink-900/10 bg-white/95 p-2 shadow-[0_20px_50px_-20px_rgba(23,23,23,0.35)] backdrop-blur-xl"
              : "absolute right-0 top-14 z-50 w-80 rounded-2xl border border-border-warm bg-white p-3 shadow-lg"
          }>
          {count === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted">Шинэ сануулга алга.</p>
          ) : (
            <ul className="grid gap-1.5">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    onClick={close}
                    className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 hover:bg-background-soft"
                  >
                    <span className="text-sm font-bold text-foreground-strong">{item.title}</span>
                    {item.detail ? <span className="text-xs text-muted">{item.detail}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
