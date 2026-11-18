import { BookOpenCheck, CalendarPlus, UserPlus, Wallet, type LucideIcon } from "lucide-react";

// Багшийн шуурхай үйлдлүүд: нүүрний картууд ба Ctrl K цонх хоёулаа нэг жагсаалтаас (D-87).
// hue, tint нь картын гэрэл, бүдэг дэвсгэр (teacher_today_v5.html).
export interface TeacherAction {
  to: string;
  title: string;
  tag: string;
  icon: LucideIcon;
  hue: string;
  tint: string;
}

export const TEACHER_ACTIONS: TeacherAction[] = [
  { to: "/teacher/enroll", title: "Сурагч бүртгэх", tag: "Сурагч", icon: UserPlus, hue: "139,26,26", tint: "#F6E9E9" },
  { to: "/teacher/classes", title: "Анги нэмэх", tag: "Анги", icon: CalendarPlus, hue: "242,174,58", tint: "#F8F0E2" },
  { to: "/teacher/students", title: "Сорил бүртгэх", tag: "Сорил", icon: BookOpenCheck, hue: "181,72,72", tint: "#F7ECEC" },
  { to: "/teacher/salary", title: "Цалин харах", tag: "Цалин", icon: Wallet, hue: "76,194,126", tint: "#EAF5EE" },
];
