import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_STATUS_LABELS, type NotificationRowDto } from "@pitoo/contracts";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { errorMessage } from "@/features/admin/list-kit";
import { formatDateTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { DataTable, Pager, type Column } from "@/shared/ui/data-table";
import { Field, FormError, Select } from "@/shared/ui/field";
import { StatusChip, type ChipTone } from "@/shared/ui/status-chip";
import { useNotificationList, useRetryNotification } from "./notifications-api";

const TONE: Record<NotificationRowDto["status"], ChipTone> = {
  PENDING: "warning",
  SENT: "info",
  DELIVERED: "success",
  FAILED: "danger",
};

const TEMPLATE_LABELS: Record<string, string> = {
  lesson_cancelled: "Хичээл цуцлагдсан",
  lesson_rescheduled: "Хичээл шилжсэн",
  attendance_recorded: "Ирц бүртгэгдсэн",
  attendance_updated: "Ирц засагдсан",
  package_ending: "Багц дуусахад ойр",
  leave_requested: "Чөлөөний хүсэлт",
  assessment_recorded: "Сорилын дүн",
  payment_recorded: "Төлбөр бүртгэгдсэн",
  payment_claim_created: "Шилжүүлгийн мэдэгдэл",
  payment_claim_rejected: "Шилжүүлэг олдсонгүй",
  password_reset: "Нууц үг сэргээх",
  placement_request_new: "Шинэ түвшин тогтоох хүсэлт",
  placement_request_forwarded: "Хүсэлт шилжүүлсэн",
  branch_lead_assigned: "Салбарын ахлагч томилсон",
};

// ФШ-63: мэдэгдэл бүрийн хүргэлтийн төлөв. Хүргэгдээгүй (алдаатай) мэдэгдлээс админ
// хүлээн авагчийг олж, өөр сувгаар холбогдоно, эсвэл дахин илгээнэ.
export function AdminNotificationsPage() {
  const [status, setStatus] = React.useState("FAILED");
  const [page, setPage] = React.useState(1);
  const list = useNotificationList(status, page);
  const retry = useRetryNotification();

  const columns: Column<NotificationRowDto>[] = [
    { key: "time", header: "Огноо", cell: (n) => formatDateTime(n.createdAt) },
    {
      key: "recipient",
      header: "Хүлээн авагч",
      cell: (n) => (
        <span>
          <strong>{n.recipientName}</strong>
          {n.recipientContact ? <span className="block text-xs text-muted">{n.recipientContact}</span> : null}
        </span>
      ),
    },
    { key: "channel", header: "Суваг", cell: (n) => NOTIFICATION_CHANNEL_LABELS[n.channel] },
    { key: "template", header: "Агуулга", cell: (n) => TEMPLATE_LABELS[n.template] ?? n.template },
    {
      key: "status",
      header: "Төлөв",
      cell: (n) => (
        <span data-testid="notification-status">
          <StatusChip tone={TONE[n.status]}>{NOTIFICATION_STATUS_LABELS[n.status]}</StatusChip>
        </span>
      ),
    },
    { key: "error", header: "Алдаа", cell: (n) => n.lastError ?? "-" },
    {
      key: "action",
      header: "",
      cell: (n) =>
        n.status === "FAILED" ? (
          <Button variant="secondary" disabled={retry.isPending} onClick={() => retry.mutate(n.id)}>
            Дахин илгээх
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Мэдэгдэл" subtitle="Мэдэгдэл бүрийн хүргэлтийн төлөв" />
      <div className="mb-4 max-w-xs">
        <Field label="Төлөв" htmlFor="notif-status">
          <Select
            id="notif-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="FAILED">Алдаатай (хүргэгдээгүй)</option>
            <option value="PENDING">Хүлээгдэж байна</option>
            <option value="SENT">Илгээсэн</option>
            <option value="DELIVERED">Хүргэгдсэн</option>
            <option value="">Бүгд</option>
          </Select>
        </Field>
      </div>
      <FormError message={errorMessage(retry.error)} />
      {list.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {list.data ? (
        <>
          <DataTable columns={columns} rows={list.data.items} rowKey={(n) => n.id} empty="Мэдэгдэл олдсонгүй." />
          <Pager page={list.data.page} limit={list.data.limit} total={list.data.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}
