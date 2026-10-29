import { describe, expect, it } from "vitest";
import { AttendanceStatus, ContractStatus } from "../../generated/prisma/client.js";
import {
  applyDelta,
  crossedToThree,
  decideStatus,
  effectsOf,
  inverseOf,
  meetingVisitReached,
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
    expect(effectsOf(AttendanceStatus.OVER_LIMIT)).toMatchObject({ visits: -1, counted: true });
  });

  it("Хүснэгт 1.3: Чөлөөтэй багцаас хасахгүй, эрхээс 1 хасна, цалинд тооцохгүй", () => {
    expect(effectsOf(AttendanceStatus.EXCUSED)).toEqual({
      visits: 0,
      leaves: -1,
      freeReviews: 0,
      counted: false,
    });
  });

  it("Хүснэгт 1.3: Нөхөлт багцаас хасна, цалинд тооцно, чөлөөнд хүрэхгүй", () => {
    expect(effectsOf(AttendanceStatus.MAKEUP)).toEqual({
      visits: -1,
      leaves: 0,
      freeReviews: 0,
      counted: true,
    });
  });

  it("ФШ-40: үнэгүй давтлага багц, цалинд нөлөөлөхгүй, давтлагын эрхээс хасна", () => {
    expect(effectsOf(AttendanceStatus.FREE_REVIEW)).toEqual({
      visits: 0,
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

  it("ФШ-36: үлдэгдэл 4-өөс 3 болоход л мэдэгдэл (3-аас 2, 5-аас 4 биш)", () => {
    expect(crossedToThree(4, 3)).toBe(true);
    expect(crossedToThree(5, 4)).toBe(false);
    expect(crossedToThree(3, 2)).toBe(false);
    // Засвараар 3-аас 4 болоод дахин 3 болсон бол дахин мэдэгдэнэ.
    expect(crossedToThree(4, 3)).toBe(true);
  });

  it("ФШ-43: 13 ба 25 дахь ирэлтэд уулзалтын сануулга", () => {
    expect(meetingVisitReached(25, 13, 12)).toBe(true); // 12 дахь ирэлт -> 13 дахь ирэлт хийгдсэн: 12 -> 13 хийсэн
    expect(meetingVisitReached(25, 14, 13)).toBe(false); // 11 -> 12 дахь ирэлт
    expect(meetingVisitReached(25, 1, 0)).toBe(true); // 25 дахь ирэлт
    expect(meetingVisitReached(25, 5, 4)).toBe(false);
  });

  it("үлдэгдэл 4-өөс 3, 1-ээс 0, засварын дараа 0-ээс 1", () => {
    const start = { remainingVisits: 4, leavesLeft: 3, freeReviewsLeft: 0 };
    const present = effectsOf(AttendanceStatus.PRESENT);
    expect(applyDelta(start, present).remainingVisits).toBe(3);
    expect(applyDelta({ ...start, remainingVisits: 1 }, present).remainingVisits).toBe(0);
    expect(applyDelta({ ...start, remainingVisits: 0 }, inverseOf(present)).remainingVisits).toBe(1);
  });

  it("Хүснэгт 3.15: Ирсэн -> Чөлөөтэй засварт багц 1 буцаж нэмэгдэж, эрх 1 хасагдана", () => {
    let counters = { remainingVisits: 10, leavesLeft: 3, freeReviewsLeft: 0 };
    counters = applyDelta(counters, inverseOf(effectsOf(AttendanceStatus.PRESENT)));
    counters = applyDelta(counters, effectsOf(AttendanceStatus.EXCUSED));
    expect(counters).toEqual({ remainingVisits: 11, leavesLeft: 2, freeReviewsLeft: 0 });
  });

  it("Хүснэгт 3.15: Ирсэн -> Чөлөө хэтэрсэн (эрх 0) засварт тоолуур өөрчлөгдөхгүй", () => {
    let counters = { remainingVisits: 10, leavesLeft: 0, freeReviewsLeft: 0 };
    counters = applyDelta(counters, inverseOf(effectsOf(AttendanceStatus.PRESENT)));
    counters = applyDelta(counters, effectsOf(AttendanceStatus.OVER_LIMIT));
    expect(counters).toEqual({ remainingVisits: 10, leavesLeft: 0, freeReviewsLeft: 0 });
  });

  it("Хүснэгт 3.15: Чөлөөтэй -> Ирсэн засварт багц 1 хасагдаж, эрх 1 буцаж нэмэгдэнэ", () => {
    let counters = { remainingVisits: 10, leavesLeft: 2, freeReviewsLeft: 0 };
    counters = applyDelta(counters, inverseOf(effectsOf(AttendanceStatus.EXCUSED)));
    counters = applyDelta(counters, effectsOf(AttendanceStatus.PRESENT));
    expect(counters).toEqual({ remainingVisits: 9, leavesLeft: 3, freeReviewsLeft: 0 });
  });
});
