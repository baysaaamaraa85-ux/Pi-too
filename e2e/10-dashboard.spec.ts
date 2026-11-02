import { expect, test } from "@playwright/test";
import {
  backdateEnrollment,
  createTeacherWithClasses,
  enrollViaApi,
  insertLesson,
  weekdaysExceptToday,
} from "./api-helpers";
import { login, loginAsAdmin, uniquePhone } from "./helpers";

// ФШ-68: админы нүүр хоёр карттай, дарахад шүүлттэй жагсаалт нээгдэнэ.
test("ФШ-68: админы самбарын хоёр карт өртэй гэрээ, сөрөг үлдэгдэлтэй багшийн шүүлттэй жагсаалт руу хөтөлнө", async ({
  page,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, {
    studentName: `Самбарын сурагч ${uniquePhone()}`,
  });
  expect(res.status()).toBe(201);

  await loginAsAdmin(page);
  const debtsCard = page.getByTestId("kpi-debts");
  const negativeCard = page.getByTestId("kpi-negative-teachers");
  await expect(debtsCard).toBeVisible();
  await expect(negativeCard).toBeVisible();
  await expect(page.getByTestId("kpi-debts-count")).not.toHaveText("...");
  const count = Number(await page.getByTestId("kpi-debts-count").innerText());
  expect(count).toBeGreaterThanOrEqual(1);

  // Өртэй гэрээний карт: "Өртэй гэрээ" табтай жагсаалт, нийт тоо картын тоотой ижил.
  await debtsCard.click();
  await expect(page).toHaveURL(/\/admin\/payments\?tab=debts$/);
  await expect(page.getByRole("tab", { name: "Өртэй гэрээ" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("total-debt")).toContainText(`(${count} гэрээ)`);

  // Сөрөг үлдэгдэлтэй багшийн карт: цалингийн хуудас, зөвхөн сөрөг үлдэгдэлтэй багш сонгогдоно.
  await page.goto("/admin");
  await page.getByTestId("kpi-negative-teachers").click();
  await expect(page).toHaveURL(/\/admin\/payroll\?negative=1$/);
  await expect(page.getByLabel("Багш", { exact: true })).toBeVisible();
  // Шинэ багш сөрөг үлдэгдэлгүй тул сонголтод байхгүй.
  await expect(
    page.getByLabel("Багш", { exact: true }).locator("option", { hasText: `Багш ${teacher.phone}` }),
  ).toHaveCount(0);
});

// ФШ-70: ирц бөглөөгүй хичээл багшийн нүүрэнд гарч, ирц хадгалмагц тэр дороо хасагдана.
test("ФШ-70: ирц бөглөөгүй хичээл багшийн самбарт гарч, ирц хадгалахад жагсаалтаас хасагдана", async ({
  page,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  // 200 минутын өмнө эхэлсэн, 120 минут үргэлжилсэн: дууссан.
  const lessonId = await insertLesson(teacher.classIds[0]!, teacher.teacherId, 200);
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, {
    studentName: `Бөглөөгүй сурагч ${uniquePhone()}`,
  });
  expect(res.status()).toBe(201);
  await backdateEnrollment(((await res.json()) as { contractId: string }).contractId);

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  const unfilled = page.getByTestId("unfilled-lesson");
  await expect(unfilled).toHaveCount(1);

  await unfilled.getByRole("link", { name: "Ирц бүртгэх" }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher/attendance/${lessonId}$`));
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByTestId("row-status").first()).toContainText("Ирсэн");

  await page.getByRole("link", { name: "Өнөөдөр" }).first().click();
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByTestId("unfilled-lessons")).toHaveCount(0);
});

// ФШ-69: сарын тайлан.
test("ФШ-69: админ сарын тайланг салбар бүрээр, байгууллагын нийлбэртэй харна", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Тайлан" }).first().click();
  await expect(page).toHaveURL(/\/admin\/reports$/);
  await expect(page.getByTestId("report-total")).toContainText("Байгууллага");
  await expect(page.getByTestId("report-branch").first()).toBeVisible();

  await page.getByLabel("Сар").fill("2031-01");
  await expect(page.getByTestId("report-total")).toContainText("0 ₮");
});

// ФШ-71: шилжүүлэх.
test("ФШ-71: админ сурагчийн гэрээг өөр багшийн ангид шилжүүлж, аудитад бичигдэнэ", async ({ page, request }) => {
  const from = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const to = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const res = await enrollViaApi(request, from.token, from.classIds, {
    studentName: `Шилжих сурагч ${uniquePhone()}`,
  });
  expect(res.status()).toBe(201);
  const { studentId } = (await res.json()) as { studentId: string };

  await loginAsAdmin(page);
  await page.goto(`/admin/students/${studentId}`);
  await expect(page.getByText(`Багш ${from.phone}`).first()).toBeVisible();

  await page.getByRole("button", { name: "Шилжүүлэх" }).first().click();
  await page.getByLabel("Шинэ анги", { exact: true }).selectOption(to.classIds[0]!);
  await page.getByLabel("Шалтгаан", { exact: true }).fill("e2e шилжилт");
  await page.getByRole("dialog").getByRole("button", { name: "Шилжүүлэх" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Шилжилт маргаашаас эхэлдэг тул хуучин бүртгэл өнөөдөр хүртэл, шинэ нь жагсаалтад нэмэгдэнэ.
  await expect(page.getByText(`Багш ${to.phone}`).first()).toBeVisible();

  // Аудитын хуудсанд TRANSFER үйлдэл шалтгаантай гарна.
  await page.getByRole("link", { name: "Аудит" }).first().click();
  await page.getByLabel("Үйлдэл", { exact: true }).fill("TRANSFER");
  const row = page.getByRole("row").filter({ hasText: "e2e шилжилт" });
  await expect(row.first()).toBeVisible();
  await expect(row.first()).toContainText("contract");
});
