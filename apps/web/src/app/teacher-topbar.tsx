import { useTeacherDashboard } from "@/features/dashboard/dashboard-api";
import { formatDate, formatTime } from "@/shared/format/date";
import { AppTopBar, ReminderBell, SearchBox, type BellItem } from "./app-topbar";

// Багшийн дээд мөр: сурагч хайх, сануулгын хонх (ирц бөглөөгүй хичээл, уулзалтын сануулга), гарах.
export function TeacherTopBar({ onLogout }: { onLogout: () => void }) {
  const dash = useTeacherDashboard();
  const items: BellItem[] = [
    ...(dash.data?.unfilledLessons ?? []).map((l) => ({
      key: `lesson-${l.id}`,
      to: `/teacher/attendance/${l.id}`,
      title: "Ирц бөглөөгүй хичээл",
      detail: `${formatDate(l.startsAt)} ${formatTime(l.startsAt)} · ${l.branchName}`,
    })),
    ...(dash.data?.tasks ?? []).map((t) => ({
      key: `task-${t.id}`,
      to: `/teacher/students/${t.studentId}`,
      title: t.type === "MEETING" ? "Эцэг эхтэй уулзах" : "Багцын шалгалт",
      detail: t.studentName,
    })),
  ];
  return (
    <AppTopBar
      left={<SearchBox placeholder="Сурагч хайх..." ariaLabel="Сурагч хайх" to="/teacher/students" />}
      bell={<ReminderBell items={items} />}
      onLogout={onLogout}
    />
  );
}
