import { Prisma } from "../../generated/prisma/client.js";
import type { LedgerRowDto, LedgerSummaryDto } from "@pitoo/contracts";
import { LEDGER_TYPE_LABELS, ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from "@pitoo/contracts";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { createRequire } from "node:module";

// ФШ-59: цалингийн тайланг Excel, PDF файлаар гаргана. Файлын нийлбэр системийн
// тооцоотой (summary.balance биш, мөрүүдийн нийлбэр) тэнцүү байна.

const require = createRequire(import.meta.url);

export interface ReportData {
  title: string;
  periodLabel: string;
  rows: LedgerRowDto[];
  summary: LedgerSummaryDto & { total: string };
}

function sumRows(rows: LedgerRowDto[]): string {
  return rows.reduce((acc, r) => acc.plus(r.amount), new Prisma.Decimal(0)).toFixed(2);
}

export function buildTotal(rows: LedgerRowDto[]): string {
  return sumRows(rows);
}

function statusLabel(status: string | null): string {
  return status ? (ATTENDANCE_STATUS_LABELS[status as AttendanceStatus] ?? status) : "";
}

const COLUMNS = [
  { header: "Огноо", key: "date", width: 12 },
  { header: "Багш", key: "teacher", width: 22 },
  { header: "Салбар", key: "branch", width: 18 },
  { header: "Анги", key: "classLabel", width: 16 },
  { header: "Сурагч", key: "student", width: 22 },
  { header: "Төлөв", key: "status", width: 16 },
  { header: "Цагийн үнэлгээ", key: "rate", width: 14 },
  { header: "Хугацаа (цаг)", key: "hours", width: 12 },
  { header: "Дүн (төгрөг)", key: "amount", width: 14 },
  { header: "Төрөл", key: "type", width: 12 },
] as const;

function rowValues(r: LedgerRowDto) {
  return {
    date: r.date,
    teacher: r.teacherName,
    branch: r.branchName ?? "",
    classLabel: r.classLabel ?? "",
    student: r.studentName ?? "",
    status: statusLabel(r.attendanceStatus),
    rate: r.rateUsed ? Number(r.rateUsed) : null,
    hours: r.durationHours ? Number(r.durationHours) : null,
    amount: Number(r.amount),
    type: LEDGER_TYPE_LABELS[r.type],
  };
}

export async function buildXlsx(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Цалин");
  sheet.addRow([data.title]).font = { bold: true, size: 14 };
  sheet.addRow([data.periodLabel]);
  sheet.addRow([]);
  sheet.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));
  const header = sheet.addRow(COLUMNS.map((c) => c.header));
  header.font = { bold: true };
  for (const r of data.rows) sheet.addRow(Object.values(rowValues(r)));
  const total = sheet.addRow([]);
  total.getCell(1).value = "Нийт";
  total.getCell(9).value = Number(data.summary.total);
  total.font = { bold: true };
  sheet.addRow([]);
  sheet.addRow(["Олсон цалин", Number(data.summary.earned)]);
  sheet.addRow(["Олгосон", Number(data.summary.paid)]);
  sheet.addRow(["Үлдэгдэл", Number(data.summary.balance)]);
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

function groupDigits(value: string): string {
  const negative = value.startsWith("-");
  const [whole = "0"] = value.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negative ? "-" : ""}${grouped}`;
}

export function buildPdf(data: ReportData): Promise<Buffer> {
  const regular = require.resolve("@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf");
  const bold = require.resolve("@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("R", regular);
    doc.registerFont("B", bold);
    doc.font("B").fontSize(14).text(data.title);
    doc.font("R").fontSize(9).text(data.periodLabel);
    doc.moveDown(0.5);

    const widths = [58, 90, 70, 70, 100, 70, 52, 48, 62, 52];
    const heads = COLUMNS.map((c) => c.header);
    const drawRow = (cells: string[], bolded = false) => {
      const y = doc.y;
      let x = 30;
      doc.font(bolded ? "B" : "R").fontSize(7.5);
      cells.forEach((cell, i) => {
        doc.text(cell, x, y, { width: (widths[i] ?? 60) - 4, lineBreak: false, ellipsis: true });
        x += widths[i] ?? 60;
      });
      doc.y = y + 13;
      if (doc.y > 540) doc.addPage();
    };

    drawRow(heads, true);
    for (const r of data.rows) {
      const v = rowValues(r);
      drawRow([
        v.date,
        v.teacher,
        v.branch,
        v.classLabel,
        v.student,
        v.status,
        v.rate === null ? "" : groupDigits(String(v.rate)),
        v.hours === null ? "" : String(v.hours),
        groupDigits(r.amount),
        v.type,
      ]);
    }
    doc.moveDown(0.5);
    drawRow(["Нийт", "", "", "", "", "", "", "", groupDigits(data.summary.total), ""], true);
    doc.moveDown(0.5);
    doc.font("R").fontSize(9);
    doc.text(
      `Олсон цалин: ${groupDigits(data.summary.earned)} төгрөг   Олгосон: ${groupDigits(data.summary.paid)} төгрөг   Үлдэгдэл: ${groupDigits(data.summary.balance)} төгрөг`,
      30,
    );
    doc.end();
  });
}
