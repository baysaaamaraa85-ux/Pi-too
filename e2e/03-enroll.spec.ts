import { expect, test } from "@playwright/test";
import { createTeacherWithClasses, enrollViaApi } from "./api-helpers";
import {
  changeTemporaryPassword,
  login,
  loginAsAdmin,
  logout,
  readCredentials,
  uniquePhone,
} from "./helpers";

async function fillWizardToConfirm(
  page: import("@playwright/test").Page,
  opts: { parentPhone: string; studentName: string; classCount: number },
) {
  await page.getByLabel("Эцэг эхийн утас").fill(opts.parentPhone);
  await page.getByLabel("Эцэг эхийн бүтэн нэр (шинэ данс үүснэ)").fill("Шинэ Эцэг");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByLabel("Сурагчийн бүтэн нэр").fill(opts.studentName);
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByLabel("Хөтөлбөр").selectOption({ index: 1 });
  const options = page.getByTestId("class-options").getByRole("checkbox");
  await expect(options).toHaveCount(2);
  for (let i = 0; i < opts.classCount; i++) await options.nth(i).check();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByLabel("Журамтай танилцсан огноо").fill("2026-10-28");
  await page.getByLabel("Эцэг эх төвийн журамтай танилцсан.").check();
  await page.getByLabel("Эцэг эх хүүхдийн хувийн мэдээллийг боловсруулахыг зөвшөөрсөн.").check();
}

// Шинэ шаардлага 1.4: багш сурагч бүртгэнэ, админы "Сурагчид" жагсаалтад хуудас
// дахин ачаалахгүйгээр бүх мэдээлэлтэй гарна.
test("багш сурагч бүртгэхэд админы жагсаалтад хөтөлбөр, анги, багц, чөлөөтэй гарна", async ({
  page,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, [1, 3]);
  const parentPhone = uniquePhone();
  const studentName = `Бүртгэсэн ${parentPhone}`;

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("link", { name: "Сурагчид" }).first().click();
  await page.getByRole("link", { name: "Сурагч бүртгэх" }).click();

  await fillWizardToConfirm(page, { parentPhone, studentName, classCount: 2 });
  await expect(page.getByTestId("class-options")).toHaveCount(0);
  await page.getByRole("button", { name: "Бүртгэх", exact: true }).click();

  await expect(page.getByTestId("enroll-done")).toContainText("багцын үлдэгдэл 25");
  await expect(page.getByTestId("enroll-done")).toContainText("чөлөөний эрх 3");
  const parent = await readCredentials(page);

  // Багшийн "Сурагчид" жагсаалтад шууд гарна.
  await page.getByRole("link", { name: "Сурагчид" }).first().click();
  await expect(page.getByTestId("student-card").filter({ hasText: studentName })).toBeVisible();

  // Админы "Сурагчид" жагсаалтад хөтөлбөр, анги, багц, чөлөөтэй гарна.
  await logout(page);
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Сурагчид" }).first().click();
  await page.getByLabel("Нэр, эцэг эхийн утасаар хайх").fill(parentPhone);
  const row = page.getByRole("row").filter({ hasText: studentName });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("package-balance")).toHaveText("25/25");
  await expect(row).toContainText("10:00");
  await expect(row).toContainText(`Багш ${teacher.phone}`);

  // Эцэг эх түр нууц үгээр нэвтэрч, хүүхдээ харна.
  await logout(page);
  await login(page, parent.identifier, parent.password);
  await changeTemporaryPassword(page, parent.password, "EtsegNew123!", /\/portal$/);
  await expect(page.getByText(studentName).first()).toBeVisible();
});

test("ФШ-22: нэг анги сонговол анхааруулга гарч, баталгаажуулбал хадгална", async ({
  page,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, [2, 4]);
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto("/teacher/enroll");

  await fillWizardToConfirm(page, {
    parentPhone: uniquePhone(),
    studentName: "Нэг ангитай",
    classCount: 1,
  });
  await page.getByRole("button", { name: "Бүртгэх", exact: true }).click();

  await expect(page.getByRole("dialog")).toContainText("2-4 удаа");
  await page.getByRole("button", { name: "Онцгой тохиолдол, хадгална" }).click();
  await expect(page.getByTestId("enroll-done")).toBeVisible();
});

test("ADR-008: багш бусад багшийн ангид сурагч бүртгэхэд 403", async ({ request }) => {
  const owner = await createTeacherWithClasses(request, [1, 2]);
  const other = await createTeacherWithClasses(request, [5]);
  const res = await enrollViaApi(request, other.token, owner.classIds, {
    studentName: "Хориотой",
  });
  expect(res.status()).toBe(403);
});

test("ФШ-72, 75: багш сурагчийг урт хугацааны чөлөөнд оруулж, дараа нь үргэлжлүүлнэ", async ({
  page,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, [1, 3]);
  const studentName = `Чөлөөтэй ${uniquePhone()}`;
  const created = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName });
  expect(created.status()).toBe(201);

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto("/teacher/students");
  const card = page.getByTestId("student-card").filter({ hasText: studentName });
  await card.getByRole("button", { name: "Урт хугацааны чөлөө" }).click();
  await page.getByLabel("Шалтгаан").fill("Гадаад аялал");
  await page.getByRole("button", { name: "Түр зогсоох" }).click();
  await expect(card).toContainText("Түр зогсоосон");

  await card.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(card).toContainText("Идэвхтэй");
  await expect(card).toContainText("25/25");
});
