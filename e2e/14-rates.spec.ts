import { expect, test } from "@playwright/test";
import {
  apiAsAdmin,
  bearer,
  createTeacherWithClasses,
  enrollViaApi,
  firstProgramId,
  setRateViaApi,
  weekdaysExceptToday,
} from "./api-helpers";
import { login, loginAsAdmin, uniquePhone } from "./helpers";

// D-67: багш хүүхэд тус бүр дээрээ цагийн үнэлгээгээ оруулна. Захирал протоколоор тулгаж, ах дүүгийн хөнгөлөлт тавина.

async function enrollOne(request: Parameters<typeof enrollViaApi>[0], teacher: { token: string; classIds: string[] }, name: string) {
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name, rate: false });
  expect(res.status()).toBe(201);
  return (await res.json()) as { contractId: string; studentId: string };
}

test("D-67: багш хүүхдэд цагийн үнэлгээ оруулаагүй бол сануулга гарч, оруулсны дараа үнэлгээ харагдана", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const name = `Үнэлгээ ${uniquePhone()}`;
  const enrolled = await enrollOne(request, teacher, name);

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByTestId("unrated-notice")).toContainText("1 сурагчид цагийн үнэлгээ оруулаагүй");

  await page.getByTestId("unrated-notice").getByRole("link", { name: "Үнэлгээ оруулах" }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher/students/${enrolled.studentId}$`));
  await expect(page.getByTestId("contract-rate-missing")).toContainText("0 ₮");

  await page.locator(`#rate-${enrolled.contractId}`).fill("40000");
  await page.getByTestId("contract-rate").getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByTestId("contract-rate-saved")).toBeVisible();
  await expect(page.getByTestId("contract-rate-current")).toContainText("40 000 ₮");
  await expect(page.getByTestId("contract-rate-missing")).toHaveCount(0);

  // Нүүрний сануулга алга болно.
  await page.goto("/teacher");
  await expect(page.getByText(name).first()).toHaveCount(0);
  await expect(page.getByTestId("unrated-notice")).toHaveCount(0);
});

test("D-67: захирал хөтөлбөрийн протокол тогтоож, багшийн үнэлгээг нүдээр тулгана (Зөрсөн -> Таарсан)", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const name = `Тулгалт ${uniquePhone()}`;
  const enrolled = await enrollOne(request, teacher, name);
  await setRateViaApi(request, teacher.token, enrolled.contractId, "35000.00");

  const admin = await apiAsAdmin(request);
  const programs = (await (await request.get("/api/v1/programs", { headers: bearer(admin.token) })).json()) as { id: string; name: string }[];
  const programId = await firstProgramId(request);
  const program = programs.find((p) => p.id === programId)!;

  await loginAsAdmin(page);
  await page.goto("/admin/payroll");
  await page.getByRole("link", { name: "Цалингийн протокол" }).click();
  await expect(page).toHaveURL(/\/admin\/payroll\/protocol$/);
  const panel = page.getByTestId("rate-protocol");
  await panel.getByLabel(`${program.name} протоколын цагийн үнэлгээ`).fill("40000");
  await panel.getByTestId("protocol-program").filter({ hasText: program.name }).getByRole("button", { name: "Хадгалах" }).click();
  await expect(panel.getByText("Хадгалагдлаа")).toBeVisible();

  await panel.getByLabel("Тулгах багш").selectOption({ label: `Багш ${teacher.phone}` });
  const row = panel.getByTestId("protocol-row").filter({ hasText: name });
  await expect(row).toHaveAttribute("data-status", "DIFFERENT");
  await expect(row).toContainText("40 000 ₮");
  await expect(row).toContainText("35 000 ₮");
  await expect(row).toContainText("Зөрсөн");

  // Багш үнэлгээгээ протоколд нийцүүлбэл "Таарсан".
  await setRateViaApi(request, teacher.token, enrolled.contractId, "40000.00");
  await page.reload();
  await panel.getByLabel("Тулгах багш").selectOption({ label: `Багш ${teacher.phone}` });
  await expect(panel.getByTestId("protocol-row").filter({ hasText: name })).toHaveAttribute("data-status", "MATCH");

  // Төлөвөөр шүүнэ.
  await panel.getByLabel("Тулгалтын төлөв").selectOption("DIFFERENT");
  await expect(panel.getByTestId("protocol-row").filter({ hasText: name })).toHaveCount(0);
});

test("D-67: захирал ах дүүгийн хөнгөлөлт тавихад төлөх үнэ буурч, багш хөнгөлсөн цалингийн үнэлгээг харна", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const name = `Хөнгөлөлт ${uniquePhone()}`;
  const enrolled = await enrollOne(request, teacher, name);
  await setRateViaApi(request, teacher.token, enrolled.contractId, "40000.00");

  await loginAsAdmin(page);
  await page.goto(`/admin/students/${enrolled.studentId}`);
  const box = page.getByTestId("contract-discount");
  await expect(box).toContainText("0%");
  await box.getByRole("button", { name: "Хөнгөлөлт өөрчлөх" }).click();
  await box.getByLabel("Хувь (%)").fill("10");
  await box.getByRole("button", { name: "Хадгалах" }).click();
  await expect(box).toContainText("10%");
  await expect(box).toContainText("->");

  // Хөнгөлөлт 100-аас их бол хадгалах товч идэвхгүй.
  await box.getByRole("button", { name: "Хөнгөлөлт өөрчлөх" }).click();
  await box.getByLabel("Хувь (%)").fill("101");
  await expect(box.getByRole("button", { name: "Хадгалах" })).toBeDisabled();

  // Багшийн дэлгэц: хөнгөлөлт, цалинд бодогдох үнэлгээ 36 000 ₮.
  await page.context().clearCookies();
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto(`/teacher/students/${enrolled.studentId}`);
  await expect(page.getByTestId("contract-rate-current")).toContainText("40 000 ₮");
  await expect(page.getByTestId("contract-rate-current")).toContainText("хөнгөлөлт 10%");
  await expect(page.getByTestId("contract-rate-current")).toContainText("36 000 ₮");
});

test("D-67: багшийн хуучин ерөнхий цагийн үнэлгээний API, админы багшийн хуудасны үнэлгээний хэсэг байхгүй", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const admin = await apiAsAdmin(request);
  const old = await request.post(`/api/v1/teachers/${teacher.teacherId}/rates`, {
    headers: bearer(admin.token),
    data: { hourlyRate: "18000.00", effectiveFrom: "2026-11-01" },
  });
  expect(old.status()).toBe(404);

  await loginAsAdmin(page);
  await page.goto(`/admin/teachers/${teacher.teacherId}`);
  await expect(page.getByRole("heading", { name: "Ангиуд" })).toBeVisible();
  await expect(page.getByText("Цагийн үнэлгээ", { exact: true })).toHaveCount(0);
});
