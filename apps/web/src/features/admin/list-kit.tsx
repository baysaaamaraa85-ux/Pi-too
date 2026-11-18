import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Search } from "lucide-react";
import * as React from "react";
import { useSearchParams } from "react-router";
import { ApiError, api } from "@/shared/api-client/client";
import type { BranchDto } from "@/shared/api-client/types";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import {
  useResetPassword,
  useSetUserActive,
  type Credentials,
  type ListFilters,
} from "./directory-api";

export function useBranches() {
  return useQuery({ queryKey: ["branches"], queryFn: () => api.get<BranchDto[]>("/branches") });
}

export function useListFilters() {
  // Дээд мөрний хайлт `?q=`-ээр орж ирнэ.
  const [urlParams] = useSearchParams();
  const [filters, setFilters] = React.useState<ListFilters>({
    search: urlParams.get("q") ?? "",
    branchId: "",
    status: "",
    page: 1,
  });
  // Шүүлт өөрчлөгдөхөд эхний хуудас руу буцна.
  const update = (patch: Partial<Omit<ListFilters, "page">>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  const setPage = (page: number) => setFilters((prev) => ({ ...prev, page }));
  return { filters, update, setPage };
}

export function FilterBar({
  filters,
  onChange,
  statusOptions,
  searchLabel = "Нэр, утасаар хайх",
  hideBranch,
}: {
  filters: ListFilters;
  onChange: (patch: Partial<Omit<ListFilters, "page">>) => void;
  statusOptions: { value: string; label: string }[];
  searchLabel?: string;
  hideBranch?: boolean;
}) {
  const branches = useBranches();
  return (
    <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_200px_200px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="pl-10"
        />
      </div>
      {hideBranch ? null : (
        <Select
          aria-label="Салбараар шүүх"
          value={filters.branchId}
          onChange={(e) => onChange({ branchId: e.target.value })}
        >
          <option value="">Бүх салбар</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      )}
      <Select
        aria-label="Төлвөөр шүүх"
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value })}
      >
        <option value="">Бүх төлөв</option>
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export const USER_STATUS_OPTIONS = [
  { value: "active", label: "Идэвхтэй" },
  { value: "inactive", label: "Идэвхгүй" },
];

// ФШ-03: түр нууц үгийг НЭГ удаа харуулна, хуулах товчтой.
export function CredentialsCard({ credentials, title }: { credentials: Credentials; title: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Card className="border-success/30 bg-success-bg" data-testid="credentials">
      <CardContent className="p-5">
        <p className="text-sm font-bold text-success">{title}</p>
        <p className="mt-2 text-sm text-mid">
          Нэвтрэх нэр: <strong data-testid="cred-identifier">{credentials.identifier}</strong>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-mid">
            Түр нууц үг:{" "}
            <code
              data-testid="cred-password"
              className="rounded-md bg-white px-2 py-1 font-mono text-base font-bold text-foreground-strong"
            >
              {credentials.tempPassword}
            </code>
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(credentials.tempPassword);
              setCopied(true);
            }}
          >
            <Copy className="size-4" /> {copied ? "Хуулсан" : "Хуулах"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Энэ нууц үг дахин харагдахгүй. Хэрэглэгчид өгнө үү, анхны нэвтрэлтээр заавал солино.
        </p>
      </CardContent>
    </Card>
  );
}

export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.problem.detail : "Алдаа гарлаа.";
}

// Түүхгүй бүртгэлийг бодитоор устгах (салбар, багш, сурагч). Буцаах боломжгүй тул
// баталгаажуулах цонхтой (ФБШ-12). Түүхтэй бол сервер 409 буцааж, шалтгааныг цонхонд харуулна.
export function DeleteRecordButton({
  path,
  label,
  title,
  description,
  testId,
  onDeleted,
}: {
  path: string;
  label: string;
  title: string;
  description: string;
  testId: string;
  onDeleted: () => void | Promise<unknown>;
}) {
  const [open, setOpen] = React.useState(false);
  const remove = useMutation({
    mutationFn: () => api.delete(path),
    onSuccess: async () => {
      setOpen(false);
      await onDeleted();
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="danger"
        data-testid={testId}
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        description={`${errorMessage(remove.error) ?? ""} ${description}`.trim()}
        confirmLabel="Устгах"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// Данс идэвхгүй болгох (ФШ-06) ба нууц үг шинээр үүсгэх (ФШ-03). Мөнгө биш ч
// буцаах боломжгүй үйлдэл тул баталгаажуулах цонхтой.
export function AccountActions({
  userId,
  isActive,
  mustChangePassword,
}: {
  userId: string;
  isActive: boolean;
  mustChangePassword: boolean;
}) {
  const [confirmToggle, setConfirmToggle] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [credentials, setCredentials] = React.useState<Credentials | null>(null);
  const setActive = useSetUserActive();
  const reset = useResetPassword();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setActive.reset();
            setConfirmToggle(true);
          }}
        >
          {isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            reset.reset();
            setConfirmReset(true);
          }}
        >
          Нууц үг шинээр үүсгэх
        </Button>
        {mustChangePassword ? (
          <span className="self-center text-xs text-muted">Түр нууц үгээ солиогүй байна</span>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmToggle}
        title={isActive ? "Данс идэвхгүй болгох уу?" : "Данс идэвхжүүлэх үү?"}
        description={`${errorMessage(setActive.error) ?? ""} ${
          isActive
            ? "Хэрэглэгч нэвтрэх боломжгүй болно. Өмнөх бүртгэл, түүх хадгалагдана."
            : "Хэрэглэгч дахин нэвтэрч чадна."
        }`.trim()}
        confirmLabel={isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
        busy={setActive.isPending}
        onConfirm={() =>
          setActive.mutate({ userId, isActive: !isActive }, { onSuccess: () => setConfirmToggle(false) })
        }
        onClose={() => setConfirmToggle(false)}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Нууц үг шинээр үүсгэх үү?"
        description={`${errorMessage(reset.error) ?? ""} Хуучин нууц үг хүчингүй болж, хэрэглэгч шинэ түр нууц үгээр нэвтэрч заавал солино.`.trim()}
        confirmLabel="Шинээр үүсгэх"
        busy={reset.isPending}
        onConfirm={() =>
          reset.mutate(userId, {
            onSuccess: (result) => {
              setCredentials(result);
              setConfirmReset(false);
            },
          })
        }
        onClose={() => setConfirmReset(false)}
      />
      <Modal open={credentials !== null} title="Шинэ түр нууц үг" onClose={() => setCredentials(null)}>
        {credentials ? <CredentialsCard credentials={credentials} title="Нууц үг шинэчлэгдлээ" /> : null}
      </Modal>
    </div>
  );
}
