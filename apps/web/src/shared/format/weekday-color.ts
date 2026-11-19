import type * as React from "react";

// D-100: багшийн ангиудыг гарагаар нь өнгөөр ялгана (Даваа = 1 ... Ням = 7). Нэг гарагийн ангиуд нэг өнгөтэй.
// Зөвхөн ангийн карт дээр зүүн зураас, бүдэг дэвсгэр, цэг болгон хэрэглэнэ. Брэндийн улаан болон сайтын өнгөний
// схемд хамаарахгүй. Бичвэр хэвээр foreground өнгөтэй тул өнгөнөөс хамаарч уншигдах байдал буурахгүй.
const WEEKDAY_ACCENTS = [
  "#2563A8", // Даваа: цэнхэр
  "#1F8A5B", // Мягмар: ногоон
  "#B77A00", // Лхагва: шар
  "#6D4BB8", // Пүрэв: нил ягаан
  "#0E8190", // Баасан: тэнгэр цэнхэр
  "#B83A78", // Бямба: ягаан
  "#C75B1E", // Ням: улбар шар
] as const;

export function weekdayAccent(weekday: number): string {
  return WEEKDAY_ACCENTS[(((weekday - 1) % 7) + 7) % 7]!;
}

// Ангийн картад тавих inline style: зүүн зураас, бүдэг дэвсгэр, нарийн хүрээ (hex + alpha).
export function weekdayCardStyle(weekday: number): React.CSSProperties {
  const accent = weekdayAccent(weekday);
  const soft = `${accent}40`;
  // Shorthand (border, borderColor) хольсон style дахин render хийхэд React анхааруулдаг тул талуудыг тус тусад нь өгнө.
  return {
    backgroundColor: `${accent}14`,
    borderLeftWidth: 5,
    borderTopColor: soft,
    borderRightColor: soft,
    borderBottomColor: soft,
    borderLeftColor: accent,
  };
}
