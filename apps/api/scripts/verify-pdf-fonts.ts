import { verifyPdfFonts } from "../src/modules/payroll/pdf-fonts.verify.js";

// Docker build-ийн алхам: node --import tsx scripts/verify-pdf-fonts.ts
// Шрифт image-д байхгүй бол non-zero кодоор гарч build-ийг зогсооно.
try {
  await verifyPdfFonts();
  console.log("PDF шрифт шалгалт амжилттай: Roboto (Кирилл) image-д байна.");
} catch (error) {
  console.error("PDF шрифт шалгалт АМЖИЛТГҮЙ:", error instanceof Error ? error.message : error);
  process.exit(1);
}
