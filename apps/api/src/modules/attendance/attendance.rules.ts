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
  visits: number;
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
      return { visits: -1, leaves: 0, freeReviews: 0, counted: true };
    case AttendanceStatus.EXCUSED:
      return { visits: 0, leaves: -1, freeReviews: 0, counted: false };
    case AttendanceStatus.FREE_REVIEW:
      return { visits: 0, leaves: 0, freeReviews: -1, counted: false };
  }
}

// Засвар: хуучин төлвийн нөлөөг буцаана (тэмдэг эсрэг).
export function inverseOf(effects: Effects): Pick<Effects, "visits" | "leaves" | "freeReviews"> {
  return { visits: -effects.visits, leaves: -effects.leaves, freeReviews: -effects.freeReviews };
}

export interface Counters {
  remainingVisits: number;
  leavesLeft: number;
  freeReviewsLeft: number;
}

export function applyDelta(
  counters: Counters,
  delta: Pick<Effects, "visits" | "leaves" | "freeReviews">,
): Counters {
  return {
    remainingVisits: counters.remainingVisits + delta.visits,
    leavesLeft: counters.leavesLeft + delta.leaves,
    freeReviewsLeft: counters.freeReviewsLeft + delta.freeReviews,
  };
}

// ФШ-36: үлдэгдэл 4-өөс 3 болох үед нэг л удаа.
export function crossedToThree(before: number, after: number): boolean {
  return before === 4 && after === 3;
}

// ФШ-43: гэрээний дундах (13 дахь) болон сүүлийн (25 дахь) ирэлт. Дундах = багцын хагас.
export function meetingVisitReached(total: number, before: number, after: number): boolean {
  const done = (remaining: number) => total - remaining;
  const midpoint = Math.ceil(total / 2);
  const wasBefore = done(before);
  const isAfter = done(after);
  return [midpoint, total].some((v) => wasBefore < v && isAfter >= v);
}
