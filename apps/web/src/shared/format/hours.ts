// D-70: академик цаг. 72 -> "72", 70.75 -> "70.75", 4.5 -> "4.5".
export function formatHours(value: number | string): string {
  return String(Number(Number(value).toFixed(2)));
}

// "HH:MM" -> минут.
export function toMinutes(hm: string): number {
  const [h = "0", m = "0"] = hm.split(":");
  return Number(h) * 60 + Number(m);
}

// Бодит цагийн урьдчилсан тооцоо (сервер дахин тооцно): минут -> академик цаг.
export function academicHoursOf(minutes: number, academicHourMinutes: number): number {
  return Math.round((minutes / academicHourMinutes + Number.EPSILON) * 100) / 100;
}
