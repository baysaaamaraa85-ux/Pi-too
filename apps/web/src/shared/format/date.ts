const TIME_ZONE = "Asia/Ulaanbaatar";

// ФБШ-11: огноог ОООО.СС.ӨӨ хэлбэрээр.
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("mn-MN", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

// Улаанбаатарын календарийн өдрийг "YYYY-MM-DD" түлхүүр болгоно (бүлэглэхэд).
export function localDateKey(value: string | Date): string {
  return formatDate(value).replace(/\./g, "-");
}

export const WEEKDAY_NAMES = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];

// 1 = Даваа ... 7 = Ням (classes.weekday-тай ижил).
export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? "";
}

export function weekdayOf(value: string | Date): number {
  const key = localDateKey(value);
  const js = new Date(`${key}T00:00:00Z`).getUTCDay();
  return js === 0 ? 7 : js;
}

export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
