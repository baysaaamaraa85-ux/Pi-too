import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDF_FONT_SPECIFIERS, resolvePdfFonts } from "./pdf-fonts.js";
import { verifyPdfFonts } from "./pdf-fonts.verify.js";

// ФШ-59: цалингийн PDF-д Кирилл үсэг гарахын тулд Roboto шрифт заавал байх ёстой.
// Docker image-д ч ижил шалгалт build-ийн явцад ажиллана (scripts/verify-pdf-fonts.ts).
describe("ФШ-59: PDF шрифт", () => {
  it("Roboto Regular, Bold файл node_modules-аас олдоно", () => {
    const fonts = resolvePdfFonts();
    expect(existsSync(fonts.regular)).toBe(true);
    expect(existsSync(fonts.bold)).toBe(true);
    expect(fonts.regular).toContain("Roboto_400Regular.ttf");
    expect(fonts.bold).toContain("Roboto_700Bold.ttf");
  });

  it("шрифтийн зам нь @expo-google-fonts/roboto багцаас (Dockerfile-д энэ багц орсон байх ёстой)", () => {
    expect(PDF_FONT_SPECIFIERS.regular.startsWith("@expo-google-fonts/roboto/")).toBe(true);
    expect(PDF_FONT_SPECIFIERS.bold.startsWith("@expo-google-fonts/roboto/")).toBe(true);
  });

  it("шрифт зөв TTF, Кирилл glyph-тэй, PDF-д шигтгэгдэнэ", async () => {
    await expect(verifyPdfFonts()).resolves.toBeUndefined();
  });
});
