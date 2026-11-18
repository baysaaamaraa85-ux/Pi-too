import { Bell, CalendarDays, FileBarChart, ListChecks, Settings, UserPlus, Users, Wallet, type LucideIcon } from "lucide-react";

// Захирлын самбарын тохиргооны сонголт, шуурхай үйлдлүүд: нүүрний картууд ба Ctrl K цонх хоёулаа нэг жагсаалтаас (D-88).
// hue, tint нь картын гэрэл, бүдэг дэвсгэр (admin_dashboard_v2.html).
export interface AdminLink {
  to: string;
  label: string;
  icon: LucideIcon;
  hue: string;
  tint: string;
}

export const ADMIN_SETUP: AdminLink[] = [
  { to: "/admin/catalog", label: "Салбар, хөтөлбөр, журам", icon: Settings, hue: "139,26,26", tint: "#F6E9E9" },
  { to: "/admin/payroll/protocol", label: "Цалингийн протокол: цагийн үнэлгээг тулгах", icon: Wallet, hue: "242,174,58", tint: "#F8F0E2" },
  { to: "/admin/teachers", label: "Багш, сурагч, эцэг эх", icon: Users, hue: "181,72,72", tint: "#F7ECEC" },
  { to: "/admin/setup", label: "Анхны тохиргооны алхмууд", icon: ListChecks, hue: "76,194,126", tint: "#EAF5EE" },
];

export const ADMIN_ACTIONS: AdminLink[] = [
  { to: "/admin/enroll", label: "Сурагч бүртгэх", icon: UserPlus, hue: "139,26,26", tint: "#F9F6F2" },
  { to: "/admin/teachers", label: "Багш нэмэх", icon: Users, hue: "181,72,72", tint: "#F9F6F2" },
  { to: "/admin/attendance", label: "Ирц харах", icon: CalendarDays, hue: "242,174,58", tint: "#F9F6F2" },
  { to: "/admin/payments", label: "Төлбөр бүртгэх", icon: Wallet, hue: "76,194,126", tint: "#F9F6F2" },
  { to: "/admin/notifications", label: "Мэдэгдэл харах", icon: Bell, hue: "242,174,58", tint: "#F9F6F2" },
  { to: "/admin/reports", label: "Тайлан гаргах", icon: FileBarChart, hue: "139,26,26", tint: "#F9F6F2" },
];
