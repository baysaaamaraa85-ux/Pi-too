import type { TeacherProgressPointDto } from "@pitoo/contracts";
import { TrendingUp } from "lucide-react";
import * as React from "react";
import { addDaysToKey, localDateKey, weekdayName, weekdayOf } from "@/shared/format/date";
import { PanelTitle, panelClass } from "@/shared/ui/dash";
import { cn } from "@/shared/ui/utils";

// ---- Ахицын график: 7 хоног, 1 сар, 3 сараар нэгтгэсэн дундаж дүн (%).
// Багшийн нүүр (сурагчдын дундаж) болон сурагч, эцэг эхийн нүүр (өөрийн дүн) хоёулаа ашиглана.
type Range = "week" | "month" | "quarter";
const RANGES: { key: Range; label: string }[] = [
  { key: "week", label: "7 хоног" },
  { key: "month", label: "1 сар" },
  { key: "quarter", label: "3 сар" },
];

interface Bucket {
  label: string;
  value: number | null;
}

function daysBetween(fromKey: string, toKey: string) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

// Өдөр тутмын дундажуудыг (жин нь сорилын тоо) сонгосон хугацаагаар нэгтгэнэ.
export function bucketize(points: TeacherProgressPointDto[], range: Range, today: string): Bucket[] {
  const weighted = (items: TeacherProgressPointDto[]): number | null => {
    const count = items.reduce((s, p) => s + p.count, 0);
    if (count === 0) return null;
    return items.reduce((s, p) => s + Number(p.averagePercent) * p.count, 0) / count;
  };

  if (range === "week") {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDaysToKey(today, i - 6);
      return {
        label: weekdayName(weekdayOf(key)).slice(0, 3),
        value: weighted(points.filter((p) => p.date === key)),
      };
    });
  }
  if (range === "month") {
    return Array.from({ length: 5 }, (_, i) => {
      const b = 4 - i; // 4 = хамгийн эртний 7 хоног
      const start = addDaysToKey(today, -(b * 7 + 6));
      const inBucket = points.filter((p) => Math.floor(daysBetween(p.date, today) / 7) === b);
      return { label: `${start.slice(5, 7)}.${start.slice(8, 10)}`, value: weighted(inBucket) };
    });
  }
  const monthOf = (key: string, delta: number) => {
    const [y, m] = key.split("-").map(Number) as [number, number];
    const idx = y * 12 + (m - 1) + delta;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  };
  return [-2, -1, 0].map((delta) => {
    const month = monthOf(today, delta);
    return {
      label: `${Number(month.slice(5, 7))}-р сар`,
      value: weighted(points.filter((p) => p.date.startsWith(month))),
    };
  });
}

export function ProgressTrend({ buckets, label = "Сурагчдын дундаж ахиц" }: { buckets: Bucket[]; label?: string }) {
  const id = React.useId().replace(/:/g, "");
  // Өргөнийг хэмжиж viewBox-д өгнө: график ямар өргөнтэй ч бичвэр 1:1 хэмжээтэй, өндөр тогтмол.
  const box = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(320);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = 160;
  const pad = { left: 38, right: 24, top: 22, bottom: 26 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const inset = 34;
  const x = (i: number) =>
    pad.left + (buckets.length <= 1 ? innerW / 2 : inset + (i / (buckets.length - 1)) * (innerW - 2 * inset));
  const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;
  const filled = buckets.flatMap((b, i) => (b.value === null ? [] : [{ i, label: b.label, value: b.value }]));
  const line = filled.map((p) => `${x(p.i)},${y(p.value)}`).join(" ");
  const area = filled.length > 1 ? `${x(filled[0]!.i)},${pad.top + innerH} ${line} ${x(filled[filled.length - 1]!.i)},${pad.top + innerH}` : "";

  return (
    <div ref={box} className="w-full min-w-0 overflow-hidden">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${label}: ${filled.map((p) => `${p.label} ${Math.round(p.value)}%`).join(", ")}`}
      className="block"
      data-testid="trend-chart"
    >
      <defs>
        <linearGradient id={`area-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeDasharray="3 5" />
          <text x={pad.left - 10} y={y(g) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">
            {g}
          </text>
        </g>
      ))}
      {area ? <polygon points={area} fill={`url(#area-${id})`} /> : null}
      {filled.length > 1 ? (
        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
      ) : null}
      {filled.map((p) => (
        <g key={p.i} data-testid="trend-point">
          <circle cx={x(p.i)} cy={y(p.value)} r="5.5" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2.5" />
          <text x={x(p.i)} y={y(p.value) - 12} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-primary)">
            {Math.round(p.value)}%
          </text>
        </g>
      ))}
      {buckets.map((b, i) => (
        <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="12.5" fill="var(--color-mid)">
          {b.label}
        </text>
      ))}
    </svg>
    </div>
  );
}

export function ProgressPanel({
  points,
  title = "Сурагчдын ахиц (%)",
  chartLabel,
  className,
}: {
  points: TeacherProgressPointDto[];
  title?: string;
  chartLabel?: string;
  className?: string;
}) {
  const [range, setRange] = React.useState<Range>("month");
  const today = localDateKey(new Date());
  const buckets = React.useMemo(() => bucketize(points, range, today), [points, range, today]);
  const hasData = buckets.some((b) => b.value !== null);

  return (
    <section className={cn(panelClass, className)} aria-labelledby="trend-title" data-testid="progress-panel">
      <PanelTitle
        icon={TrendingUp}
        action={
          <div role="group" aria-label="Хугацаа" className="flex gap-0.5 rounded-xl bg-background-soft p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "min-h-11 rounded-lg px-3.5 text-[0.8rem] font-semibold transition-colors",
                  range === r.key ? "bg-primary text-primary-foreground shadow-soft" : "text-mid hover:text-primary",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      >
        <span id="trend-title">{title}</span>
      </PanelTitle>
      {hasData ? (
        <ProgressTrend buckets={buckets} label={chartLabel} />
      ) : (
        <p className="rounded-2xl bg-background-soft px-5 py-10 text-center text-sm text-muted">
          Энэ хугацаанд сорил, шалгалтын дүн бүртгэгдээгүй байна.
        </p>
      )}
    </section>
  );
}
