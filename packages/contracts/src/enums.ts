// Эдгээр enum, Prisma схемын утгуудтай (prisma/schema.prisma) яг таарсан байх ёстой.
// Нэг схемыг хоёр газар бичихгүй байхын тулд энд зөвхөн API/frontend-д
// хэрэгтэй тал (утга + монгол шошго)-ыг тодорхойлно.

export const Role = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  PARENT: "PARENT",
  STUDENT: "STUDENT",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Админ",
  TEACHER: "Багш",
  PARENT: "Эцэг эх",
  STUDENT: "Сурагч",
};

// ФШ-26: ирцийн 5 төлөв. Багцаас хасах, цалинд тооцох шинж (CLAUDE.md 6.4).
export const AttendanceStatus = {
  PRESENT: "PRESENT",
  EXCUSED: "EXCUSED",
  OVER_LIMIT: "OVER_LIMIT",
  MAKEUP: "MAKEUP",
  FREE_REVIEW: "FREE_REVIEW",
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Ирсэн",
  EXCUSED: "Чөлөөтэй",
  OVER_LIMIT: "Чөлөө хэтэрсэн",
  MAKEUP: "Нөхөлт",
  FREE_REVIEW: "Үнэгүй давтлага",
};

export const ContractStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Идэвхтэй",
  PAUSED: "Түр зогсоосон",
  COMPLETED: "Дууссан",
};

export const LessonStatus = {
  SCHEDULED: "SCHEDULED",
  CANCELLED: "CANCELLED",
  RESCHEDULED: "RESCHEDULED",
} as const;
export type LessonStatus = (typeof LessonStatus)[keyof typeof LessonStatus];

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  SCHEDULED: "Товлогдсон",
  CANCELLED: "Цуцлагдсан",
  RESCHEDULED: "Шилжүүлсэн",
};
