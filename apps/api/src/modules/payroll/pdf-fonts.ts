import { createRequire } from "node:module";

// ФШ-59: цалингийн PDF Кирилл үсэгтэй тул pdfkit-ийн өгөгдмөл (Helvetica) шрифт хэрэглэгдэхгүй,
// Roboto TTF файлыг node_modules-аас унших ёстой. Docker image-д энэ файл орж байгааг
// pdf-fonts.verify.ts шалгана (image build, тест хоёроос).
const require = createRequire(import.meta.url);

export const PDF_FONT_SPECIFIERS = {
  regular: "@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf",
  bold: "@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf",
} as const;

export interface PdfFonts {
  regular: string;
  bold: string;
}

// Файл олдохгүй бол require.resolve өөрөө алдаа шиднэ.
export function resolvePdfFonts(): PdfFonts {
  return {
    regular: require.resolve(PDF_FONT_SPECIFIERS.regular),
    bold: require.resolve(PDF_FONT_SPECIFIERS.bold),
  };
}
