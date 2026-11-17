import { describe, expect, it } from "vitest";
import { AttendanceStatus, ContractStatus } from "../../generated/prisma/client.js";
import {
  academicHours,
  applyDelta,
  crossedToThreshold,
  decideStatus,
  effectsOf,
  forwardOf,
  inverseOf,
  meetingHoursReached,
  packageDeduction,
} from "./attendance.rules.js";

const base = {
  present: true,
  isMakeup: false,
  contractStatus: ContractStatus.ACTIVE,
  leavesLeft: 3,
  freeReviewsLeft: 0,
};

describe("М5 ирцийн төлвийн дүрэм (цэвэр)", () => {
  it("ФШ-27: ирсэн бол Ирсэн, нөхөлтийн мөр бол Нөхөлт", () => {
    expect(decideStatus(base)).toBe(AttendanceStatus.PRESENT);
    expect(decideStatus({ ...base, isMakeup: true })).toBe(AttendanceStatus.MAKEUP);
  });

  it("ФШ-28: чөлөөний эрх 1 үед ирээгүй бол Чөлөөтэй", () => {
    expect(decideStatus({ ...base, present: false, leavesLeft: 1 })).toBe(AttendanceStatus.EXCUSED);
  });

  it("ФШ-29: чөлөөний эрх 0 үед Чөлөө хэтэрсэн болж багцаас хасна", () => {
    const status = decideStatus({ ...base, present: false, leavesLeft: 0 });
    expect(status).toBe(AttendanceStatus.OVER_LIMIT);
    expect(effectsOf(AttendanceStatus.OVER_LIMIT)).toMatchObject({ consumesPackage: true, counted: true });
  });

  it("Хүснэгт 1.3: Чөлөөтэй багцаас хасахгүй, эрхээс 1 хасна, цалинд тооцохгүй", () => {
    expect(effectsOf(AttendanceStatus.EXCUSED)).toEqual({
      consumesPackage: false,
      leaves: -1,
      freeReviews: 0,
      counted: false,
    });
  });

  it("Хүснэгт 1.3: Нөхөлт багцаас хасна, цалинд тооцно, чөлөөнд хүрэхгүй", () => {
    expect(effectsOf(AttendanceStatus.MAKEUP)).toEqual({
      consumesPackage: true,
      leaves: 0,
      freeReviews: 0,
      counted: true,
    });
  });

  it("ФШ-40: үнэгүй давтлага багц, цалинд нөлөөлөхгүй, давтлагын эрхээс хасна", () => {
    expect(effectsOf(AttendanceStatus.FREE_REVIEW)).toEqual({
      consumesPackage: false,
      leaves: 0,
      freeReviews: -1,
      counted: false,
    });
  });

  it("ФШ-37, 40: дууссан гэрээнд давтлагын эрхтэй бол Үнэгүй давтлага, эрхгүй бол 409", () => {
    const completed = { ...base, contractStatus: ContractStatus.COMPLETED };
    expect(decideStatus({ ...completed, freeReviewsLeft: 1 })).toBe(AttendanceStatus.FREE_REVIEW);
    expect(() => decideStatus({ ...completed, freeReviewsLeft: 0 })).toThrow(/давтлагын эрх/);
    // 4 дэх давтлага: эрх 3-аас 0 болсны дараа
    expect(() => decideStatus({ ...completed, freeReviewsLeft: 0 })).toThrow();
    // Дууссан гэрээнд ирээгүй сурагчид мөр үүсэхгүй.
    expect(decideStatus({ ...completed, present: false, freeReviewsLeft: 2 })).toBeNull();
  });

  it("ФШ-73: түр зогсоосон гэрээнд ирц бүртгэхгүй", () => {
    expect(() => decideStatus({ ...base, contractStatus: ContractStatus.PAUSED })).toThrow(
      /Түр зогсоосон/,
    );
  });

  it("D-70: орсон минут -> академик цаг (40 минут = 1): 120 мин = 3, 170 мин = 4.25, 20 мин = 0.5", () => {
    expect(academicHours(120, 40)).toBe(3);
    expect(academicHours(160, 40)).toBe(4);
    expect(academicHours(170, 40)).toBe(4.25);
    expect(academicHours(40, 40)).toBe(1);
    expect(academicHours(20, 40)).toBe(0.5);
    expect(academicHours(100, 40)).toBe(2.5);
    expect(academicHours(0, 40)).toBe(0);
  });

  it("D-70: багцаас хасах цаг: Ирсэн, Чөлөө хэтэрсэн, Нөхөлтөд бодит цаг; Чөлөөтэй, Үнэгүй давтлагад 0", () => {
    for (const status of [AttendanceStatus.PRESENT, AttendanceStatus.OVER_LIMIT, AttendanceStatus.MAKEUP]) {
      expect(packageDeduction(effectsOf(status), 4, 75)).toBe(4);
    }
    for (const status of [AttendanceStatus.EXCUSED, AttendanceStatus.FREE_REVIEW]) {
      expect(packageDeduction(effectsOf(status), 4, 75)).toBe(0);
    }
  });

  it("D-70: үлдэгдлээс их цаг орвол үлдэгдлээр хязгаарлагдана (багц 0 болж дуусна, сөрөг болохгүй)", () => {
    const present = effectsOf(AttendanceStatus.PRESENT);
    expect(packageDeduction(present, 4, 2)).toBe(2);
    expect(packageDeduction(present, 3, 3)).toBe(3);
    expect(packageDeduction(present, 3, 0)).toBe(0);
    const start = { remainingHours: 2, leavesLeft: 3, freeReviewsLeft: 0 };
    expect(applyDelta(start, forwardOf(present, packageDeduction(present, 4, 2))).remainingHours).toBe(0);
  });

  it("D-70: үлдэгдэл 75-аас 72 (3 цаг), 4.25 цагаар хасахад 70.75, засварт яг хасагдсан цаг буцаж нэмэгдэнэ", () => {
    const start = { remainingHours: 75, leavesLeft: 3, freeReviewsLeft: 0 };
    const present = effectsOf(AttendanceStatus.PRESENT);
    expect(applyDelta(start, forwardOf(present, 3)).remainingHours).toBe(72);
    const long = applyDelta(start, forwardOf(present, 4.25));
    expect(long.remainingHours).toBe(70.75);
    expect(applyDelta(long, inverseOf(present, 4.25))).toEqual(start);
  });

  it("ФШ-36: багцын үлдэгдэл 9 цагаас дээрээс доошоо орох үед л мэдэгдэл (9-өөс 6, 12-оос 10 биш)", () => {
    expect(crossedToThreshold(12, 9, 9)).toBe(true);
    expect(crossedToThreshold(10, 8.5, 9)).toBe(true); // хэсэгчилсэн цагаар давж орно
    expect(crossedToThreshold(15, 12, 9)).toBe(false);
    expect(crossedToThreshold(9, 6, 9)).toBe(false);
    expect(crossedToThreshold(8, 5, 9)).toBe(false);
  });

  it("ФШ-43: багцын дундах (37.5) ба сүүлийн (75) цагт уулзалтын сануулга", () => {
    expect(meetingHoursReached(75, 39, 36)).toBe(true); // 36 -> 39 цаг: дундах 37.5-г давсан
    expect(meetingHoursReached(75, 42, 39)).toBe(false);
    expect(meetingHoursReached(75, 3, 0)).toBe(true); // сүүлийн цаг
    expect(meetingHoursReached(75, 15, 12)).toBe(false);
  });

  it("үлдэгдэл 12-оос 9, 3-аас 0, засварын дараа 0-ээс 3", () => {
    const start = { remainingHours: 12, leavesLeft: 3, freeReviewsLeft: 0 };
    const present = effectsOf(AttendanceStatus.PRESENT);
    expect(applyDelta(start, forwardOf(present, 3)).remainingHours).toBe(9);
    expect(applyDelta({ ...start, remainingHours: 3 }, forwardOf(present, 3)).remainingHours).toBe(0);
    expect(applyDelta({ ...start, remainingHours: 0 }, inverseOf(present, 3)).remainingHours).toBe(3);
  });

  it("Хүснэгт 3.15: Ирсэн -> Чөлөөтэй засварт багц 3 цаг буцаж нэмэгдэж, эрх 1 хасагдана", () => {
    let counters = { remainingHours: 30, leavesLeft: 3, freeReviewsLeft: 0 };
    counters = applyDelta(counters, inverseOf(effectsOf(AttendanceStatus.PRESENT), 3));
    counters = applyDelta(counters, forwardOf(effectsOf(AttendanceStatus.EXCUSED), 0));
    expect(counters).toEqual({ remainingHours: 33, leavesLeft: 2, freeReviewsLeft: 0 });
  });

  it("Хүснэгт 3.15: Ирсэн -> Чөлөө хэтэрсэн (эрх 0) засварт тоолуур өөрчлөгдөхгүй", () => {
    let counters = { remainingHours: 30, leavesLeft: 0, freeReviewsLeft: 0 };
    counters = applyDelta(counters, inverseOf(effectsOf(AttendanceStatus.PRESENT), 3));
    counters = applyDelta(counters, forwardOf(effectsOf(AttendanceStatus.OVER_LIMIT), 3));
    expect(counters).toEqual({ remainingHours: 30, leavesLeft: 0, freeReviewsLeft: 0 });
  });

  it("Хүснэгт 3.15: Чөлөөтэй -> Ирсэн засварт багц 3 цаг хасагдаж, эрх 1 буцаж нэмэгдэнэ", () => {
    let counters = { remainingHours: 30, leavesLeft: 2, freeReviewsLeft: 0 };
    counters = applyDelta(counters, inverseOf(effectsOf(AttendanceStatus.EXCUSED), 0));
    counters = applyDelta(counters, forwardOf(effectsOf(AttendanceStatus.PRESENT), 3));
    expect(counters).toEqual({ remainingHours: 27, leavesLeft: 3, freeReviewsLeft: 0 });
  });
});
