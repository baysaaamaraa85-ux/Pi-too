import { describe, expect, it } from "vitest";
import { computeContractTerms } from "./enrollment.pricing.js";

const PRICE = "1800000.00";

describe("D-96: гэрээний цаг ба үнэ", () => {
  it("ФШ-16, 17: цаг заагаагүй бол бүтэн багц (75 цаг) бүтэн үнээр", () => {
    const t = computeContractTerms(PRICE, 75, undefined);
    expect(t.totalHours.toString()).toBe("75");
    expect(t.price.toFixed(2)).toBe("1800000.00");
  });

  it("D-96: олон улсын хөтөлбөр 1 800 000 / 75 * 10 цаг = 240 000", () => {
    const t = computeContractTerms(PRICE, 75, 10);
    expect(t.totalHours.toString()).toBe("10");
    expect(t.price.toFixed(2)).toBe("240000.00");
  });

  it("D-96: 75 цаг заавал бүтэн үнэтэй тэнцнэ", () => {
    expect(computeContractTerms(PRICE, 75, 75).price.toFixed(2)).toBe("1800000.00");
  });

  it("D-96: хагас цаг зөвшөөрнө (0.5 цаг = 12 000)", () => {
    expect(computeContractTerms(PRICE, 75, 0.5).price.toFixed(2)).toBe("12000.00");
  });

  it("D-96: үнэ хуваагдахгүй бол хоёр оронд бөөрөнхийлнө (500 000 / 75 * 10)", () => {
    expect(computeContractTerms("500000.00", 75, 10).price.toFixed(2)).toBe("66666.67");
  });

  it("D-96: багцын цагаас хэтэрвэл 422 (75.01)", () => {
    expect(() => computeContractTerms(PRICE, 75, 75.01)).toThrowError(/Сургалтын цаг 0-ээс их/);
  });

  it("D-96: 0 болон сөрөг цаг 422", () => {
    expect(() => computeContractTerms(PRICE, 75, 0)).toThrowError(/Сургалтын цаг 0-ээс их/);
    expect(() => computeContractTerms(PRICE, 75, -5)).toThrowError(/Сургалтын цаг 0-ээс их/);
  });

  it("D-96: хоёроос илүү оронтой цаг (1.234) чимээгүй бөөрөнхийлөгдөхгүй, 422", () => {
    expect(() => computeContractTerms(PRICE, 75, 1.234)).toThrowError(/Сургалтын цаг 0-ээс их/);
  });
});
