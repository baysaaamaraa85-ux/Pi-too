import { expect, test } from "@playwright/test";
import { createTeacherWithClasses } from "./api-helpers";
import { login } from "./helpers";

// ФБШ-10: багшийн хуудсууд 360 px-д хэвтээ гүйлгэлтгүй, хүрэх товч 44 px-ээс багагүй.
test.use({ viewport: { width: 360, height: 740 } });

test("ФБШ-10: багшийн хуудсууд 360 px-д хэвтээ гүйлгэлтгүй", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, [1, 3]);
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);

  for (const label of ["Өнөөдөр", "Хуваарь", "Анги", "Сурагчид", "Бүртгэл"]) {
    await page.getByRole("navigation", { name: "Үндсэн цэс" }).last().getByRole("link", { name: label }).click();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, label).toBeLessThanOrEqual(0);
  }
});

test("ФБШ-10: элсэлтийн шидтэний үндсэн товчнууд 44 px-ээс багагүй", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, [2, 4]);
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("navigation", { name: "Үндсэн цэс" }).last().getByRole("link", { name: "Бүртгэл" }).click();
  const button = page.getByRole("button", { name: "Үргэлжлүүлэх" });
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
