import type { LedgerRowDto, LedgerSummaryDto, Paginated } from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api-client/client";

export interface LedgerFilters {
  teacherId?: string;
  branchId?: string;
  type?: string;
  from?: string;
  to?: string;
  page: number;
}

export interface LedgerPage extends Paginated<LedgerRowDto> {
  summary: LedgerSummaryDto;
}

export interface TeacherBalanceRow {
  teacherId: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  earned: string;
  paid: string;
  balance: string;
}

export function ledgerQueryString(f: LedgerFilters, limit = 20): string {
  const params = new URLSearchParams({ page: String(f.page), limit: String(limit) });
  for (const key of ["teacherId", "branchId", "type", "from", "to"] as const) {
    const value = f[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}

// ФШ-56: ирц эсвэл олголт хадгалсны дараа дахин ачаалахгүйгээр шинэчлэгдэнэ
// (mutation-ы дараа ["ledger"]-ийг invalidate хийнэ, мөн 30 секунд тутам дахин татна).
export const LEDGER_REFETCH_MS = 30_000;

export function useLedger(filters: LedgerFilters, enabled = true) {
  return useQuery({
    queryKey: ["ledger", filters],
    queryFn: () => api.get<LedgerPage>(`/ledger?${ledgerQueryString(filters)}`),
    refetchInterval: LEDGER_REFETCH_MS,
    enabled,
  });
}

export function usePayrollSummary(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return useQuery({
    queryKey: ["ledger", "summary", from, to],
    queryFn: () => api.get<TeacherBalanceRow[]>(`/payroll/summary?${params.toString()}`),
    refetchInterval: LEDGER_REFETCH_MS,
  });
}
