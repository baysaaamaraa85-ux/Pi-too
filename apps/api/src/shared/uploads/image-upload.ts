import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import { env } from "../../config/env.js";
import { DomainError } from "../errors/domain-error.js";

// ФШ-78: багш, салбарын зураг. Файлыг дискэнд (UPLOAD_DIR) хадгалж, /uploads/... замаар статикаар өгнө.
// Мэдээллийн санд зөвхөн зам хадгалагдана.
export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

type ImageKind = "teachers" | "branches";

// Raw биет: Content-Type нь зөвхөн эдгээр байвал Buffer болно, үгүй бол req.body хоосон объект хэвээр.
export const imageBody = express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: MAX_IMAGE_BYTES,
});

// Клиентийн илгээсэн Content-Type-д найдахгүй, файлын эхний байтаар (magic bytes) жинхэнэ төрлийг тогтооно.
function detectExtension(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

function invalidImage(detail: string): never {
  throw new DomainError({ code: "invalid-image", status: 422, title: "Зураг буруу байна", detail });
}

export async function saveImage(kind: ImageKind, image: Buffer | null): Promise<string> {
  if (!image || image.length === 0) {
    invalidImage("Зураг илгээгдсэнгүй. JPG, PNG эсвэл WEBP файл сонгоно уу.");
  }
  if (image.length > MAX_IMAGE_BYTES) invalidImage("Зураг 3 MB-аас бага байх ёстой.");
  const ext = detectExtension(image);
  if (!ext) invalidImage("Зөвхөн JPG, PNG эсвэл WEBP зураг оруулна уу.");

  const dir = path.join(UPLOAD_ROOT, kind);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), image);
  return `/uploads/${kind}/${name}`;
}

// Зөвхөн энэ модулийн хадгалсан файлыг устгана (/images/... эсвэл https:// хаягад хүрэхгүй).
export async function removeUploadedImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const match = /^\/uploads\/(teachers|branches)\/([0-9a-f-]+\.(?:jpg|png|webp))$/.exec(url);
  if (!match) return;
  try {
    await unlink(path.join(UPLOAD_ROOT, match[1]!, match[2]!));
  } catch {
    // файл аль хэдийн байхгүй бол асуудалгүй
  }
}
