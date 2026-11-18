import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { cn } from "@/shared/ui/utils";

// Шилэн шахмал цэс (teacher_today_v5.html): идэвхтэй зүйлийн ард улаан заагч гулсаж очно. Байрлалыг хэмжиж (offsetLeft, offsetWidth) тавина.
// Стиль нь shared/pt/pt.css (.pt-glass, .pt-ind).

export interface PillItem {
  key: string;
  to: string;
  label: string;
  icon?: LucideIcon;
  // Тоон тэмдэг: alert бол анхаарах (улаавтар), үгүй бол мэдээллийн (алтлаг)
  badge?: { count: number; alert?: boolean };
}

export function PillNav({ items, activeKey, ariaLabel }: { items: PillItem[]; activeKey: string | null; ariaLabel: string }) {
  const refs = React.useRef<Record<string, HTMLLIElement | null>>({});
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null);
  const [ready, setReady] = React.useState(false);

  const place = React.useCallback(() => {
    const el = activeKey ? refs.current[activeKey] : null;
    setBox(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [activeKey]);

  React.useLayoutEffect(() => {
    place();
    window.addEventListener("resize", place);
    // Фонт ачаалагдсаны дараа өргөн өөрчлөгддөг тул дахин хэмжинэ.
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [place, items]);

  // Анхны байрлалд хөдөлгөөнгүй тавина, дараагийн солигдолд гулсуулна.
  React.useEffect(() => {
    if (!box || ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [box, ready]);

  return (
    <nav aria-label={ariaLabel} className="hidden lg:block">
      <div className="pt-glass relative rounded-full p-[5px]">
        <span className="pt-ind" data-ready={ready && box !== null} style={box ? { left: box.left, width: box.width } : undefined} aria-hidden="true" />
        <ul className="flex items-center">
          {items.map((item) => {
            const active = activeKey === item.key;
            const Icon = item.icon;
            return (
              <li
                key={item.key}
                ref={(el) => {
                  refs.current[item.key] = el;
                }}
              >
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative z-10 inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-colors motion-reduce:transition-none",
                    active ? "text-white" : "text-ink-600 hover:text-ink-900",
                  )}
                >
                  {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                  {item.label}
                  {item.badge ? (
                    <span
                      className={cn(
                        "pt-num grid size-[18px] place-items-center rounded-full text-[10px] font-bold",
                        item.badge.alert && item.badge.count > 0 ? "bg-danger text-white" : "bg-gold-400 text-ink-900",
                      )}
                    >
                      {item.badge.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

// Утасны доод шилэн шахмал цэс: дүрс, aria-label-ээр нэрлэгдэнэ. 48px өндөртэй (ФБШ-10).
// extra: жагсаалтын төгсгөлд нэмэх товч (жишээ нь "Цэс" drawer нээх).
export function PillBottomNav({
  items,
  activeKey,
  ariaLabel,
  extra,
}: {
  items: PillItem[];
  activeKey: string | null;
  ariaLabel: string;
  extra?: React.ReactNode;
}) {
  return (
    <nav aria-label={ariaLabel} className="pt-glass fixed inset-x-3 bottom-3 z-40 flex justify-between rounded-full p-1.5 lg:hidden">
      {items.map((item) => {
        const active = activeKey === item.key;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn("relative grid h-12 flex-1 place-items-center rounded-full", active ? "bg-brand-700 text-white" : "text-ink-500")}
          >
            {Icon ? <Icon className="size-5" aria-hidden="true" /> : item.label}
            {item.badge && item.badge.count > 0 && item.badge.alert ? (
              <span className="absolute right-[22%] top-2 size-2 rounded-full bg-danger ring-2 ring-white" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
      {extra}
    </nav>
  );
}
