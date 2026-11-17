import { AttendanceStatus, ContractStatus } from "../../generated/prisma/client.js";
import { DomainError } from "../../shared/errors/domain-error.js";

// Ирцийн төлвийн цэвэр дүрэм (CLAUDE.md 6.4, Хүснэгт 1.3, ADR-007). Клиент зөвхөн
// "ирсэн эсэх" илгээнэ, төлвийг сервер энд тооцно. Өгөгдлийн сан, HTTP-гүй тул шууд тестлэнэ.

export interface StatusInput {
  present: boolean;
  isMakeup: boolean;
  contractStatus: ContractStatus;
  leavesLeft: number;
  freeReviewsLeft: number;
}

function rejected(code: string, title: string, detail: string): never {
  throw new DomainError({ code, status: 409, title, detail });
}

// Буцаах утга null: ирц бүртгэхгүй (дууссан гэрээнд ирээгүй сурагчид мөр үүсэхгүй).
export function decideStatus(input: StatusInput): AttendanceStatus | null {
  // ФШ-73: түр зогсоосон гэрээнд ирц бүртгэхгүй.
  if (input.contractStatus === ContractStatus.PAUSED) {
    rejected(
      "contract-paused",
      "Гэрээ түр зогссон байна",
      "Түр зогсоосон гэрээнд ирц бүртгэх боломжгүй. Эхлээд үргэлжлүүлнэ үү.",
    );
  }

  // ФШ-37, 40: дууссан гэрээнд зөвхөн үнэгүй давтлага (эрх байвал).
  if (input.contractStatus === ContractStatus.COMPLETED) {
    if (!input.present) return null;
    if (input.freeReviewsLeft <= 0) {
      rejected(
        "free-review-exhausted",
        "Үнэгүй давтлагын эрх байхгүй",
        "Багц дууссан бөгөөд үнэгүй давтлагын эрх үлдээгүй тул ирц бүртгэх боломжгүй.",
      );
    }
    return AttendanceStatus.FREE_REVIEW;
  }

  if (input.present) {
    // ФШ-31: нөхөлт нь энгийн ирэлттэй адил багцаас хасагдана.
    return input.isMakeup ? AttendanceStatus.MAKEUP : AttendanceStatus.PRESENT;
  }
  // ФШ-28: эрх > 0 бол Чөлөөтэй. ФШ-29: эрх 0 бол Чөлөө хэтэрсэн (багцаас хасна).
  return input.leavesLeft > 0 ? AttendanceStatus.EXCUSED : AttendanceStatus.OVER_LIMIT;
}

export interface Effects {
  // D-70: багцаас хасагдах эсэх (Ирсэн, Чөлөө хэтэрсэн, Нөхөлт). Хасагдах цаг нь ирц бүрийн БОДИТ орсон
  // академик цаг (минут / 40), тогтмол нэг ирэлт биш.
  consumesPackage: boolean;
  leaves: number;
  freeReviews: number;
  // Багшийн цалинд тооцох (БД-23): багцаас хасагдсан ирэлт бүр.
  counted: boolean;
}

// Хүснэгт 1.3: төлөв бүрийн нөлөө.
export function effectsOf(status: AttendanceStatus): Effects {
  switch (status) {
    case AttendanceStatus.PRESENT:
    case AttendanceStatus.OVER_LIMIT:
    case AttendanceStatus.MAKEUP:
      return { consumesPackage: true, leaves: 0, freeReviews: 0, counted: true };
    case AttendanceStatus.EXCUSED:
      return { consumesPackage: false, leaves: -1, freeReviews: 0, counted: false };
    case AttendanceStatus.FREE_REVIEW:
      return { consumesPackage: false, leaves: 0, freeReviews: -1, counted: false };
  }
}

// Тоолуурын өөрчлөлт: hours нь тэмдэгтэй (хасалт сөрөг).
export interface Delta {
  hours: number;
  leaves: number;
  freeReviews: number;
}

// Академик цаг 2 орноор (0.01) тоологдоно: JavaScript-ийн хөвөгч таслалын алдаа хуримтлагдахгүй.
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// D-70: орсон минут -> академик цаг (нэг академик цаг = academicHourMinutes, анхдагч 40 минут).
// 120 минут = 3, 170 минут = 4.25.
export function academicHours(minutes: number, academicHourMinutes: number): number {
  return round2(minutes / academicHourMinutes);
}

// Багцаас хасах цаг: цаг бүхий л хасагдана, гэхдээ үлдэгдлээс хэтрэхгүй (багц 0 болж дуусна, сөрөг болохгүй).
export function packageDeduction(effects: Effects, hours: number, remaining: number): number {
  return effects.consumesPackage ? Math.min(round2(hours), round2(remaining)) : 0;
}

// Шинэ ирцийн нөлөө: хасагдсан цаг (deducted) нь packageDeduction-оор тооцогдсон.
export function forwardOf(effects: Effects, deducted: number): Delta {
  return { hours: -deducted, leaves: effects.leaves, freeReviews: effects.freeReviews };
}

// Засвар: хуучин ирцийн нөлөөг буцаана. Багцад яг хасагдсан цагийг (attendance.package_hours) нэмнэ.
export function inverseOf(effects: Effects, deducted: number): Delta {
  return { hours: deducted, leaves: -effects.leaves, freeReviews: -effects.freeReviews };
}

export interface Counters {
  remainingHours: number;
  leavesLeft: number;
  freeReviewsLeft: number;
}

export function applyDelta(counters: Counters, delta: Delta): Counters {
  return {
    remainingHours: round2(counters.remainingHours + delta.hours),
    leavesLeft: counters.leavesLeft + delta.leaves,
    freeReviewsLeft: counters.freeReviewsLeft + delta.freeReviews,
  };
}

// ФШ-36: багцын үлдэгдэл босгоос (3 ирэлт x нэг ирэлтийн академик цаг, жишээ нь 9) дээрээс доошоо
// орох үед нэг л удаа. Хэсэгчилсэн цагаар хасагддаг тул яг тэнцэхийг биш, давж орохыг шалгана.
export function crossedToThreshold(before: number, after: number, thresholdHours: number): boolean {
  return before > thresholdHours && after <= thresholdHours;
}

// ФШ-43: гэрээний дундах (багцын хагас) болон сүүлийн (бүтэн) цаг. Орсон цаг = нийт - үлдэгдэл.
export function meetingHoursReached(totalHours: number, before: number, after: number): boolean {
  const done = (remaining: number) => totalHours - remaining;
  const midpoint = totalHours / 2;
  const wasBefore = done(before);
  const isAfter = done(after);
  return [midpoint, totalHours].some((v) => wasBefore < v && isAfter >= v);
}
