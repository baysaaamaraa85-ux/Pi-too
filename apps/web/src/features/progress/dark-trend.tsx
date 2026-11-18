import type { TeacherProgressPointDto } from "@pitoo/contracts";
import * as React from "react";
import { bucketize } from "./progress-trend";
import { localDateKey } from "@/shared/format/date";

// Харанхуй ахицын график (D-87, D-89): багшийн нүүр (сурагчдын дундаж), эцэг эх, сурагчийн нүүр (өөрийн дүн). Загвар: teacher_today_v5.html: харанхуй дэвсгэр дээр гэрэлтдэг муруй.
// Өгөгдөл, нэгтгэл (bucketize) нь эцэг эх, сурагчийн графиктай нэг. Тест: trend-chart, trend-point, trend-average, progress-panel.
type Range = "week" | "month" | "quarter";
const RANGES: { key: Range; label: string }[] = [
  { key: "week", label: "7 хоног" },
  { key: "month", label: "1 сар" },
  { key: "quarter", label: "3 сар" },
];

const HEIGHT = 230;

function smooth(points: { x: number; y: number }[]) {
  return points.reduce((d, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = points[i - 1]!;
    const cx = (prev.x + p.x) / 2;
    return `${d} C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }, "");
}

// Хугацааны сегмент: идэвхтэй товчны ард цагаан гулсагч
function Segment({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = React.useState<{ left: number; width: number } | null>(null);
  React.useLayoutEffect(() => {
    const place = () => {
      const el = refs.current[range];
      setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    void document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, [range]);
  return (
    <div role="group" aria-label="Хугацаа" className="pt-seg">
      <span className="pt-seg-thumb" style={thumb ? { left: thumb.left, width: thumb.width } : { opacity: 0 }} aria-hidden="true" />
      {RANGES.map((r) => (
        <button
          key={r.key}
          ref={(el) => {
            refs.current[r.key] = el;
          }}
          type="button"
          aria-pressed={range === r.key}
          onClick={() => onChange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Chart({ buckets, label }: { buckets: { label: string; value: number | null }[]; label: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(320);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { left: 34, right: 14, top: 30, bottom: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = HEIGHT - pad.top - pad.bottom;
  const inset = 28;
  const x = (i: number) => pad.left + (buckets.length <= 1 ? innerW / 2 : inset + (i / (buckets.length - 1)) * (innerW - 2 * inset));
  const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;
  const filled = buckets.flatMap((b, i) => (b.value === null ? [] : [{ i, label: b.label, value: b.value, x: x(i), y: y(b.value) }]));
  const line = smooth(filled);
  const baseline = pad.top + innerH;
  const area = filled.length > 1 ? `${line} L${filled[filled.length - 1]!.x},${baseline} L${filled[0]!.x},${baseline} Z` : "";
  const id = React.useId().replace(/:/g, "");

  return (
    <div ref={box} className="relative w-full min-w-0">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${label}: ${filled.map((p) => `${p.label} ${Math.round(p.value)}%`).join(", ")}`}
        className="block overflow-visible"
        data-testid="trend-chart"
      >
        <defs>
          <linearGradient id={`lg-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#F7C978" />
            <stop offset=".55" stopColor="#D25A5A" />
            <stop offset="1" stopColor="#F2AE3A" />
          </linearGradient>
          <linearGradient id={`ag-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#B54848" stopOpacity=".45" />
            <stop offset="1" stopColor="#B54848" stopOpacity="0" />
          </linearGradient>
          <filter id={`gl-${id}`} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,.07)" />
            <text x={pad.left - 10} y={y(g) + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,.55)">
              {g}
            </text>
          </g>
        ))}
        {area ? <path d={area} fill={`url(#ag-${id})`} /> : null}
        {filled.length > 1 ? (
          <path
            d={line}
            fill="none"
            stroke={`url(#lg-${id})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            filter={`url(#gl-${id})`}
            className="pt-draw"
            style={{ "--len": width * 1.6 } as React.CSSProperties}
          />
        ) : null}
        {filled.map((p) => (
          <g key={p.i} data-testid="trend-point">
            <circle cx={p.x} cy={p.y} r="12" fill="rgba(247,201,120,.18)" />
            <circle cx={p.x} cy={p.y} r="5" fill="#fff" />
            <text x={p.x} y={p.y - 18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff">
              {Math.round(p.value)}%
            </text>
          </g>
        ))}
        {buckets.map((b, i) => (
          <text key={i} x={x(i)} y={HEIGHT - 6} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.6)">
            {b.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function DarkTrend({
  points,
  title = "Сурагчдын ахиц (%)",
  chartLabel = "Сурагчдын дундаж ахиц",
  className,
}: {
  points: TeacherProgressPointDto[];
  title?: string;
  chartLabel?: string;
  className?: string;
}) {
  const [range, setRange] = React.useState<Range>("month");
  const [today] = React.useState(() => localDateKey(new Date()));
  const buckets = React.useMemo(() => bucketize(points, range, today), [points, range, today]);
  const values = buckets.flatMap((b) => (b.value === null ? [] : [b.value]));
  const average = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;

  return (
    <article className={`pt-lib flex flex-col ${className ?? ""}`} style={{ "--tint": "#F6E9E9" } as React.CSSProperties} data-testid="progress-panel" aria-labelledby="trend-title">
      <div className="pt-cover pt-dark flex min-h-[340px] flex-1 flex-col p-5 sm:p-6">
        <div
          className="pt-glow"
          style={{
            background:
              "radial-gradient(40% 50% at 70% 30%,rgba(139,26,26,.45),transparent 70%),radial-gradient(35% 45% at 20% 80%,rgba(242,174,58,.18),transparent 70%)",
          }}
        />
        <div className="pt-dots" />
        <div className="pt-noise" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="text-white">
            <div id="trend-title" className="text-[12.5px] font-medium text-white/60">
              Дундаж ахиц
            </div>
            <div className="pt-tight pt-num mt-1 text-[44px] font-semibold leading-none" data-testid="trend-average">
              {average === null ? "-" : Math.round(average)}
              <span className="text-[26px] text-white/50">%</span>
            </div>
          </div>
          <Segment range={range} onChange={setRange} />
        </div>
        <div className="relative mt-4 flex flex-1 items-center">
          {average === null ? (
            <p className="w-full py-10 text-center text-sm text-white/70">Энэ хугацаанд сорил, шалгалтын дүн бүртгэгдээгүй байна.</p>
          ) : (
            <Chart buckets={buckets} label={chartLabel} />
          )}
        </div>
      </div>
      <div className="pt-meta flex items-center gap-2.5 px-5 py-4 sm:px-6">
        <span className="grid size-7 place-items-center rounded-full bg-brand-700 text-[12px] font-semibold text-white" aria-hidden="true">
          π
        </span>
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="hidden text-ink-300 sm:inline">·</span>
        <span className="hidden text-[13px] text-ink-500 sm:inline">Сорилын дүн</span>
      </div>
    </article>
  );
}
