import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// ФБШ-10: 360 px өргөнтэй дэлгэцэнд хэвтээ гүйлгэлт гарахгүй.
test.use({ viewport: { width: 360, height: 740 } });

for (const path of [
  "/admin",
  "/admin/teachers",
  "/admin/students",
  "/admin/parents",
  "/admin/requests",
  "/admin/catalog",
]) {
  test(`ФБШ-10: ${path} 360 px-д хэвтээ гүйлгэлтгүй`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
