import { Select } from "@/shared/ui/field";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

// 24 цагийн систем: AM/PM-гүй, цаг ба минутыг тусад нь сонгоно. Утга нь "HH:MM".
export function TimeSelect24({
  id,
  value,
  onChange,
  label = "Цаг",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [h = "10", m = "00"] = value.split(":");
  // 5 минутаар бус хуучин утга ирвэл тэр хэвээр сонгогдоно.
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Select id={id} aria-label={`${label}: цаг`} value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </Select>
      <span aria-hidden="true" className="font-bold text-muted">
        :
      </span>
      <Select aria-label={`${label}: минут`} value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </Select>
    </div>
  );
}
