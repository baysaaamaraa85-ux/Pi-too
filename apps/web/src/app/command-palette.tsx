import { ArrowRight, Search, type LucideIcon } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router";

// Хайлт ба шуурхай үйлдлийн цонх (Ctrl K, teacher_today_v5.html, admin_dashboard_v2.html). Хуудас, үйлдэл рүү шилжинэ, бичвэр бичвэл
// "Сурагч хайх" нэг мөр гарч сурагчийн жагсаалтыг нэрээр шүүнэ (өмнөх дээд мөрний хайлттай ижил үйлдэл). Багш, админ хоёулаа ашиглана.

export interface PaletteItem {
  group: string;
  label: string;
  icon: LucideIcon;
  to: string;
}

export function CommandPalette({
  open,
  onClose,
  items,
  studentsPath,
}: {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
  // Бичвэр бичихэд "Сурагч хайх" мөр энэ жагсаалт руу `?q=`-ээр шилжинэ (багш, админ тус тусын)
  studentsPath: string;
}) {
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);

  // Нээгдэх үед фокус, хаагдах үед өмнөх элемент рүү буцна.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(id);
      prev?.focus?.();
    };
  }, [open]);

  const text = q.trim();
  const view: PaletteItem[] = React.useMemo(() => {
    const needle = text.toLowerCase();
    const found = items.filter((i) => !needle || i.label.toLowerCase().includes(needle) || i.group.toLowerCase().includes(needle));
    return text
      ? [{ group: "Сурагч", label: `Сурагч хайх: ${text}`, icon: Search, to: `${studentsPath}?q=${encodeURIComponent(text)}` }, ...found]
      : found;
  }, [items, text, studentsPath]);

  const pick = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    setQ("");
    void navigate(item.to);
  };
  const active = Math.min(sel, Math.max(view.length - 1, 0));

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Хайлт ба үйлдэл"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink-900/25 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[24px] border border-paper-3 bg-white shadow-[0_40px_100px_-30px_rgba(23,23,23,0.5)]">
        <div className="flex h-[60px] items-center gap-3 border-b border-paper-3 px-5">
          <Search className="size-[18px] text-ink-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            aria-label="Хайх"
            role="combobox"
            aria-expanded="true"
            aria-controls="teacher-palette-list"
            aria-activedescendant={view.length > 0 ? `tp-${active}` : undefined}
            autoComplete="off"
            placeholder="Сурагч, хуудас, үйлдэл хайх…"
            className="h-full flex-1 bg-transparent text-[15px] placeholder:text-ink-400 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((active + 1) % Math.max(view.length, 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((active - 1 + view.length) % Math.max(view.length, 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                pick(view[active]);
              }
            }}
          />
          <kbd className="inline-flex h-6 items-center rounded-md bg-paper-2 px-2 text-[10.5px] font-semibold text-ink-500">Esc</kbd>
        </div>
        <ul id="teacher-palette-list" role="listbox" aria-label="Үр дүн" className="max-h-[360px] overflow-y-auto p-2">
          {view.length === 0 ? <li className="py-10 text-center text-[13px] text-ink-500">Илэрц олдсонгүй</li> : null}
          {view.map((item, i) => {
            const header = i === 0 || view[i - 1]!.group !== item.group;
            return (
              <React.Fragment key={`${item.group}-${item.label}`}>
                {header ? (
                  <li role="presentation" className="px-3 pb-1.5 pt-3 text-[11px] font-semibold text-ink-500">
                    {item.group}
                  </li>
                ) : null}
                <li
                  id={`tp-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => pick(item)}
                  className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[14px] aria-selected:bg-paper-2"
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-paper-2 text-ink-600">
                    <item.icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {i === active ? <ArrowRight className="size-3.5 text-ink-400" aria-hidden="true" /> : null}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <div className="flex h-11 items-center gap-4 border-t border-paper-3 px-5 text-[11.5px] text-ink-500">
          <span>↑ ↓ шилжих</span>
          <span>↵ сонгох</span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="grid size-4 place-items-center rounded bg-brand-700 text-[9px] text-white" aria-hidden="true">
              π
            </span>
            Пи тоо
          </span>
        </div>
      </div>
    </div>
  );
}
