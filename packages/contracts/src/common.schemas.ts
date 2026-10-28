import { z } from "zod";

// Утасны дугаар: хоосон зай, зураасыг хасаад 8 орон.
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{8}$/, "Утасны дугаар 8 оронтой байх ёстой"));

// Хуудаслалт: ?page=&limit=, хамгийн ихдээ 100 мөр (design 5.4.1).
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
