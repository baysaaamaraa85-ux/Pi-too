// public/favicon.svg-ээс PWA-ийн PNG дүрсүүдийг гаргана: node scripts/make-icons.mjs
// (Playwright-ийн msedge/chromium ашиглана, нэг удаа ажиллуулаад үр дүнг commit хийнэ.)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const dir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(dir, "../public");
const svg = readFileSync(path.join(publicDir, "favicon.svg"), "utf8");
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const targets = [
  ["pwa-192.png", 192],
  ["pwa-512.png", 512],
  ["apple-touch-icon.png", 180],
];

const browser = await chromium.launch({ channel: "msedge" });
for (const [name, size] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0"><img src="${dataUrl}" width="${size}" height="${size}" style="display:block"></body>`,
  );
  await page.screenshot({ path: path.join(publicDir, name), clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await browser.close();
console.log("PWA дүрсүүд бэлэн боллоо.");
