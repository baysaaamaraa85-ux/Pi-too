// ФБШ-13: бичвэр ба дэвсгэрийн өнгөний ялгарал 4.5:1-ээс багагүй эсэхийг index.css-ийн токенуудаас шалгана.
// node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/index.css"), "utf8");
const token = Object.fromEntries([...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const pairs = [
  ["foreground", "background"], ["foreground", "surface"], ["foreground-strong", "surface"], ["mid", "background"], ["mid", "surface"],
  ["muted", "background"], ["muted", "surface"], ["muted", "background-soft"],
  ["primary", "surface"], ["primary", "background"], ["primary-foreground", "primary"], ["primary-foreground", "primary-hover"],
  ["success", "success-bg"], ["warning", "warning-bg"], ["danger", "danger-bg"], ["info", "info-bg"],
  ["danger", "surface"], ["success", "surface"], ["warning", "surface"],
];
let failed = 0;
for (const [fg, bg] of pairs) {
  const r = ratio(token[fg], token[bg]);
  const ok = r >= 4.5;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${fg} on ${bg}: ${r.toFixed(2)}`);
}
process.exit(failed ? 1 : 0);
