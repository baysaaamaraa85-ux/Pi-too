import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  bearer,
  createTeacherWithClasses,
  enrollViaApi,
  insertLesson,
  weekdaysExceptToday,
} from "./api-helpers";
import { login, loginAsAdmin, logout, uniquePhone } from "./helpers";

async function setup(request: APIRequestContext, students: number) {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const lessonId = await insertLesson(teacher.classIds[0]!, teacher.teacherId, 10);
  const enrolled = [];
  for (let i = 0; i < students; i++) {
    const name = `Цалингийн сурагч ${uniquePhone()}`;
    const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name });
    expect(res.status()).toBe(201);
    enrolled.push({ name, contractId: ((await res.json()) as { contractId: string }).contractId });
  }
  return { teacher, lessonId, enrolled };
}

async function saveViaApi(
  request: APIRequestContext,
  token: string,
  lessonId: string,
  entries: { contractId: string; present: boolean }[],
) {
  const res = await request.put(`/api/v1/lessons/${lessonId}/attendance`, {
    headers: { ...bearer(token), "Idempotency-Key": randomUUID() },
    data: { entries },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as { entries: { attendanceId: string }[] };
}

async function selectTeacher(page: import("@playwright/test").Page, phone: string) {
  await page.getByLabel("Багш", { exact: true }).selectOption({ label: `Багш ${phone}` });
}

test("багш ирц хадгалахад админы Цалин хуудсанд сурагч бүрийн нэртэй мөр зөв дүнтэй гарна", async ({
  page,
  request,
}) => {
  const { teacher, lessonId, enrolled } = await setup(request, 2);
  await saveViaApi(request, teacher.token, lessonId, enrolled.map((e) => ({ contractId: e.contractId, present: true })));

  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Цалин" }).first().click();
  await selectTeacher(page, teacher.phone);

  // 5 000 x 2 цаг = 10 000 ₮, сурагч бүрт нэг мөр.
  for (const s of enrolled) {
    const row = page.getByRole("row").filter({ hasText: s.name });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("ledger-amount")).toHaveText("10 000 ₮");
    await expect(row).toContainText("Цалин");
    await expect(row).toContainText("Ирсэн");
  }
  await expect(page.getByTestId("card-earned")).toContainText("20 000 ₮");
  await expect(page.getByTestId("card-balance")).toContainText("20 000 ₮");
});

test("ирцийг Ирээгүй болгож засахад админы Цалин хуудсанд сөрөг залруулга гарна (хуудас дахин ачаалахгүйгээр)", async ({
  page,
  request,
}) => {
  const { teacher, lessonId, enrolled } = await setup(request, 1);
  const saved = await saveViaApi(request, teacher.token, lessonId, [
    { contractId: enrolled[0]!.contractId, present: true },
  ]);

  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Цалин" }).first().click();
  await selectTeacher(page, teacher.phone);
  await expect(page.getByTestId("card-balance")).toContainText("10 000 ₮");

  const patch = await request.patch(`/api/v1/attendance/${saved.entries[0]!.attendanceId}`, {
    headers: bearer(teacher.token),
    data: { present: false },
  });
  expect(patch.status()).toBe(200);

  // 30 секунд тутмын автомат шинэчлэлт (ФШ-56): reload хийхгүй.
  const row = page.getByRole("row").filter({ hasText: "Залруулга" });
  await expect(row).toBeVisible({ timeout: 45_000 });
  await expect(row.getByTestId("ledger-amount")).toHaveText("-10 000 ₮");
  await expect(page.getByTestId("card-balance")).toContainText("0 ₮");
});

test("ФБШ-31: үлдэгдлээс их олголтод баталгаажуулах цонх гарч, баталгаажуулбал сөрөг үлдэгдэл улаанаар бичвэртэй", async ({
  page,
  request,
}) => {
  const { teacher, lessonId, enrolled } = await setup(request, 1);
  await saveViaApi(request, teacher.token, lessonId, [{ contractId: enrolled[0]!.contractId, present: true }]);

  await loginAsAdmin(page);
  await page.goto("/admin/payroll");
  await selectTeacher(page, teacher.phone);
  await page.getByRole("button", { name: "Мөнгө олгох" }).first().click();
  await page.getByLabel("Дүн (₮)").fill("50000");
  await page.getByRole("button", { name: "Олгох", exact: true }).click();

  await expect(page.getByRole("dialog").filter({ hasText: "баталгаажуулах" })).toContainText("үлдэгдлээс");
  await page.getByRole("button", { name: "Тийм, олгоно" }).click();

  await expect(page.getByTestId("card-balance")).toContainText("-40 000 ₮");
  await expect(page.getByTestId("card-balance")).toContainText("Сөрөг үлдэгдэл");
  await expect(page.getByRole("row").filter({ hasText: "Олголт" })).toBeVisible();
});

test("ФШ-58, D-68: багш цалингаа сурагч бүрээр харна: цаг, цагийн цалин, авах цалин, төлбөрийн төлөв", async ({ page, request }) => {
  const { teacher, lessonId, enrolled } = await setup(request, 2);
  await saveViaApi(request, teacher.token, lessonId, enrolled.map((e) => ({ contractId: e.contractId, present: true })));

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("navigation", { name: "Багшийн цэс" }).getByRole("link", { name: "Цалин" }).click();

  await expect(page.getByTestId("card-earned")).toContainText("20 000 ₮");
  // Өдрөөр биш, сурагч бүрээр: хоёр сурагч, тус бүр нэг карт.
  await expect(page.getByTestId("salary-student")).toHaveCount(2);
  for (const s of enrolled) {
    const card = page.getByTestId("salary-student").filter({ hasText: s.name });
    await expect(card.getByTestId("salary-expected")).toContainText("75");
    await expect(card.getByTestId("salary-academic")).toContainText("3");
    await expect(card.getByTestId("salary-hours")).toHaveText("2");
    await expect(card.getByTestId("salary-rate")).toContainText("5 000 ₮");
    await expect(card.getByTestId("salary-earned")).toContainText("10 000 ₮");
    await expect(card.getByTestId("salary-payment")).toHaveText("Төлөгдөөгүй");
  }

  // "Орсон цаг" дээр дарахад хичээл бүрийн оролт popup-д гарна.
  const first = page.getByTestId("salary-student").filter({ hasText: enrolled[0]!.name });
  await first.getByTestId("salary-hours").click();
  await expect(page.getByTestId("entry-row")).toHaveCount(1);
  // D-73: зөвхөн огноо, цаг, цалин (хугацаа, төлөв, томьёо давхардуулахгүй).
  await expect(page.getByTestId("entry-row")).toContainText("2 цаг");
  await expect(page.getByTestId("entry-row")).not.toContainText("120 мин");
  await expect(page.getByTestId("entry-amount")).toHaveText("10 000 ₮");
  await page.keyboard.press("Escape");

  // Цагийн цалинг засахад (хүүхдийн хуудаснаас) авах цалин шинэчлэгдэнэ.
  await first.getByRole("link", { name: "Цагийн цалинг засах" }).click();
  await page.locator('input[id^="rate-"]').fill("7500");
  await page.getByTestId("contract-rate").getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByTestId("contract-rate-saved")).toBeVisible();
  await page.getByRole("navigation", { name: "Багшийн цэс" }).getByRole("link", { name: "Цалин" }).click();
  await expect(page.getByTestId("salary-student").filter({ hasText: enrolled[0]!.name }).getByTestId("salary-earned")).toContainText("15 000 ₮");
  await logout(page);
});

test("D-99: багш бүх хүүхдийн цагийн цалинг нэг цонхонд оруулж хадгалахад хүүхэд бүрийн цалин өөрийнх нь цалингаар бодогдоно", async ({ page, request }) => {
  const { teacher, lessonId, enrolled } = await setup(request, 2);
  await saveViaApi(request, teacher.token, lessonId, enrolled.map((e) => ({ contractId: e.contractId, present: true })));

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("navigation", { name: "Багшийн цэс" }).getByRole("link", { name: "Цалин" }).click();

  await page.getByTestId("bulk-rate-open").click();
  await expect(page.getByTestId("bulk-rate-row")).toHaveCount(2);
  // Өөрчлөлтгүй үед хадгалах боломжгүй.
  await expect(page.getByTestId("bulk-rate-save")).toBeDisabled();
  await page.getByLabel(`${enrolled[0]!.name}: цагийн цалин`).fill("7500");
  await page.getByLabel(`${enrolled[1]!.name}: цагийн цалин`).fill("6000");
  await expect(page.getByTestId("bulk-rate-count")).toContainText("2 хүүхдийн");
  await page.getByTestId("bulk-rate-save").click();

  await expect(page.getByTestId("bulk-rate-saved")).toContainText("2 хүүхдийн цагийн цалин хадгалагдлаа");
  // 2 цагийн хичээл: 7 500 x 2 = 15 000, 6 000 x 2 = 12 000.
  const earned = (n: string) => page.getByTestId("salary-student").filter({ hasText: n }).getByTestId("salary-earned");
  await expect(earned(enrolled[0]!.name)).toContainText("15 000 ₮");
  await expect(earned(enrolled[1]!.name)).toContainText("12 000 ₮");
  await logout(page);
});

test("D-68: багш төлөгдөөгүй хүүхдийн эцэг эхэд мэдэгдэл илгээнэ, өдөрт нэг удаа", async ({ page, request }) => {
  const { teacher, enrolled } = await setup(request, 1);
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("navigation", { name: "Багшийн цэс" }).getByRole("link", { name: "Цалин" }).click();

  const card = page.getByTestId("salary-student").filter({ hasText: enrolled[0]!.name });
  await card.getByRole("button", { name: "Эцэг эхэд мэдэгдэл илгээх" }).click();
  await expect(card.getByTestId("reminder-sent")).toBeVisible();
  await expect(card.getByText("Сүүлд илгээсэн")).toBeVisible();

  // Дахин илгээхийг сервер татгалзана.
  await card.getByRole("button", { name: "Эцэг эхэд мэдэгдэл илгээх" }).click();
  await expect(card.getByRole("alert")).toContainText("өнөөдөр");
  await logout(page);
});

test.describe("ФБШ-10: утасны дэлгэц", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("Цалингийн хуудас 360 px-д хэвтээ гүйлгэлтгүй", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/payroll");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
