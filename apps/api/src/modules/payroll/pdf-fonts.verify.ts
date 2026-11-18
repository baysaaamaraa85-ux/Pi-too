import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { buildPdf, type ReportData } from "./payroll.reports.js";
import { resolvePdfFonts } from "./pdf-fonts.js";

// Энэ шалгалтыг хоёр газар ажиллуулна:
//   1. vitest (pdf-fonts.test.ts), хөгжүүлэлтийн орчинд
//   2. Docker image build-ийн явцад (apps/api/scripts/verify-pdf-fonts.ts), image-д
//      шрифт жинхэнэ орсныг батлахгүй бол build амжилтгүй болно.
// Env, өгөгдлийн сан хэрэггүй, зөвхөн файл ба pdfkit.

const MIN_FONT_BYTES = 50_000; // Roboto TTF ~160 KB. Хоосон, тасарсан файлыг барина.
const CYRILLIC_SAMPLE = "ЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноөпрстуүфхцчшщъыьэюя";

function isTrueType(head: Buffer): boolean {
  // 0x00010000 (TrueType), "true" (Apple), "OTTO" (CFF OpenType)
  return (
    head.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) ||
    head.toString("ascii") === "true" ||
    head.toString("ascii") === "OTTO"
  );
}

type FontkitFont = { hasGlyphForCodePoint(codePoint: number): boolean };
type FontkitModule = { openSync(file: string): FontkitFont };

export async function verifyPdfFonts(): Promise<void> {
  const fonts = resolvePdfFonts();

  // fontkit нь pdfkit-ийн дотоод хамаарал, тиймээс pdfkit-ийн байрлалаас нь ачаална.
  const requireFromPdfkit = createRequire(createRequire(import.meta.url).resolve("pdfkit"));
  const fontkit = requireFromPdfkit("fontkit") as FontkitModule;

  for (const [name, file] of Object.entries(fonts)) {
    const bytes = readFileSync(file);
    if (bytes.length < MIN_FONT_BYTES) {
      throw new Error(`Шрифт "${name}" (${file}) хэт жижиг: ${bytes.length} байт.`);
    }
    if (!isTrueType(bytes.subarray(0, 4))) {
      throw new Error(`Шрифт "${name}" (${file}) TTF/OTF файл биш байна.`);
    }
    const font = fontkit.openSync(file);
    const missing = [...CYRILLIC_SAMPLE].filter((ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0)!));
    if (missing.length > 0) {
      throw new Error(`Шрифт "${name}"-д Кирилл үсэг дутуу: ${missing.join("")}`);
    }
  }

  // Жинхэнэ PDF үүсгэгчээр дамжуулж шалгана (шрифт бүртгэгдэж, PDF-д шигтгэгдсэн эсэх).
  const sample: ReportData = {
    title: "Цалингийн тайлан",
    periodLabel: "2026.11.01 - 2026.11.30",
    rows: [],
    summary: { earned: "0.00", paid: "0.00", balance: "0.00", total: "0.00" },
  };
  const pdf = await buildPdf(sample);
  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("PDF үүссэнгүй (толгой буруу).");
  }
  if (!pdf.toString("latin1").includes("Roboto")) {
    throw new Error("PDF-д Roboto шрифт шигтгэгдсэнгүй.");
  }
}
