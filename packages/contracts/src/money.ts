import { z } from "zod";

// Мөнгийг JavaScript-ийн number-оор дамжуулахгүй (ФБШ-02, CLAUDE.md 6.8).
// API-д "40000.00" хэлбэрийн тэмдэгт мөрөөр дамжина, backend Prisma Decimal
// болгоно.
export const moneySchema = z
  .string()
  .regex(/^\d+\.\d{2}$/, 'Мөнгийг "40000.00" хэлбэрээр бичнэ');

export type Money = z.infer<typeof moneySchema>;
