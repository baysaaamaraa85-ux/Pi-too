import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  backdateEnrollment,
  createTeacherWithClasses,
  enrollViaApi,
  insertLeaveRequest,
  insertLesson,
  weekdaysExceptToday,
} from "./api-helpers";
import { login, loginAsAdmin, logout, uniquePhone } from "./helpers";

async function setup(request: APIRequestContext, startOffsetMin: number, students = 1) {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const lessonId = await insertLesson(teacher.classIds[0]!, teacher.teacherId, startOffsetMin);
  const enrolled = [];
  for (let i = 0; i < students; i++) {
    const name = `Ирцийн сурагч ${uniquePhone()}`;
    const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name });
    expect(res.status()).toBe(201);
    enrolled.push({ name, contractId: ((await res.json()) as { contractId: string }).contractId });
  }
  return { teacher, lessonId, enrolled };
}

async function loginTeacher(page: import("@playwright/test").Page, t: { phone: string; password: string }) {
  await login(page, t.phone, t.password);
  await expect(page).toHaveURL(/\/teacher$/);
}

// ФБШ-08, ФШ-27, 32: нүүрнээс 2 товшилт (бүгд ирсэн), 30 секундээс бага.
test("багш өнөөдрийн жагсаалтаас ирцийг 2 товшилтоор, 30 секундээс бага хугацаанд бүртгэнэ", async ({
  page,
  request,
}) => {
  const { teacher, enrolled } = await setup(request, 10, 2);
  await loginTeacher(page, teacher);

  const started = Date.now();
  await page.getByRole("link", { name: "Ирц бүртгэх" }).click(); // 1-р товшилт
  await expect(page.getByTestId("attendance-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Хадгалах" }).click(); // 2-р товшилт
  await expect(page.getByTestId("row-status").first()).toContainText("Ирсэн");
  expect(Date.now() - started).toBeLessThan(30_000);

  for (const s of enrolled) {
    const row = page.getByTestId("attendance-row").filter({ hasText: s.name });
    await expect(row.getByTestId("row-balance")).toHaveText("24/25");
    await expect(row.getByTestId("row-status")).toHaveText("Ирсэн");
  }
});

test("ФШ-28, 30: чөлөө хүссэн сурагч урьдчилан Ирээгүй, сервер Чөлөөтэй гэж тооцож багц хэвээр", async ({
  page,
  request,
}) => {
  const { teacher, lessonId, enrolled } = await setup(request, 10, 2);
  await insertLeaveRequest(enrolled[0]!.contractId, lessonId, teacher.teacherId);
  await loginTeacher(page, teacher);
  await page.goto(`/teacher/attendance/${lessonId}`);

  const absent = page.getByTestId("attendance-row").filter({ hasText: enrolled[0]!.name });
  await expect(absent).toContainText("Чөлөө хүссэн");
  await expect(absent.getByRole("button", { name: "Ирээгүй" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(absent.getByTestId("row-status")).toHaveText("Чөлөөтэй");
  await expect(absent.getByTestId("row-balance")).toHaveText("25/25");
  const present = page.getByTestId("attendance-row").filter({ hasText: enrolled[1]!.name });
  await expect(present.getByTestId("row-balance")).toHaveText("24/25");
});

test("ФШ-33, 34, 35: ирц засахад төлөв, багц шинэчлэгдэж, админ түүхийг харна", async ({
  page,
  request,
}) => {
  const { teacher, lessonId, enrolled } = await setup(request, 10);
  await loginTeacher(page, teacher);
  await page.goto(`/teacher/attendance/${lessonId}`);
  await page.getByRole("button", { name: "Хадгалах" }).click();
  const row = page.getByTestId("attendance-row").filter({ hasText: enrolled[0]!.name });
  await expect(row.getByTestId("row-status")).toHaveText("Ирсэн");

  await row.getByRole("button", { name: "Засах" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ирээгүй" }).click();
  await page.getByLabel("Шалтгаан").fill("Алдаатай тэмдэглэсэн");
  await page.getByRole("dialog").getByRole("button", { name: "Засах", exact: true }).click();
  await page.getByRole("alertdialog").or(page.getByRole("dialog").last()).getByRole("button", { name: "Засах", exact: true }).last().click();

  await expect(row.getByTestId("row-status")).toHaveText("Чөлөөтэй");
  await expect(row.getByTestId("row-balance")).toHaveText("25/25");
});

test("ФШ-33: 25 цагийн дараа багшид хаалттай, админ шалтгаантай бүртгэнэ", async ({ page, request }) => {
  const { teacher, lessonId, enrolled } = await setup(request, 25 * 60 + 120);
  await backdateEnrollment(enrolled[0]!.contractId);
  await loginTeacher(page, teacher);
  await page.goto(`/teacher/attendance/${lessonId}`);
  await expect(page.getByTestId("window-closed")).toContainText("Зөвхөн админ засна");
  await expect(page.getByRole("button", { name: "Хадгалах" })).toHaveCount(0);
  await logout(page);

  await loginAsAdmin(page);
  await page.goto(`/admin/attendance/${lessonId}`);
  await expect(page.getByTestId("window-closed")).toContainText("Админ шалтгаан");
  const save = page.getByRole("button", { name: "Хадгалах" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Шалтгаан").fill("Багш мартсан");
  await save.click();
  const row = page.getByTestId("attendance-row").filter({ hasText: enrolled[0]!.name });
  await expect(row.getByTestId("row-status")).toHaveText("Ирсэн");
});

test("админ ирцийн жагсаалтаас хичээлийг нээж, бүртгэсэн тоог харна", async ({ page, request }) => {
  const { teacher, lessonId, enrolled } = await setup(request, 10);
  await loginTeacher(page, teacher);
  await page.goto(`/teacher/attendance/${lessonId}`);
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByTestId("row-status")).toHaveText("Ирсэн");
  await logout(page);

  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Ирц" }).first().click();
  const lesson = page.getByTestId("day-lesson").filter({ hasText: teacher.phone });
  await expect(lesson).toContainText("Бүртгэсэн 1/1");
  await lesson.click();
  await expect(page.getByTestId("attendance-row").filter({ hasText: enrolled[0]!.name })).toBeVisible();
});

test.describe("ФБШ-10: утасны дэлгэц", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("ирцийн дэлгэц 360 px-д гүйлгэлтгүй, сэлгүүр ба хадгалах товч 44 px-ээс багагүй", async ({
    page,
    request,
  }) => {
    const { teacher, lessonId } = await setup(request, 10, 3);
    await loginTeacher(page, teacher);
    await page.goto(`/teacher/attendance/${lessonId}`);
    await expect(page.getByTestId("attendance-row")).toHaveCount(3);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    for (const name of ["Ирсэн", "Ирээгүй", "Хадгалах"]) {
      const box = await page.getByRole("button", { name }).first().boundingBox();
      expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
    }
  });
});
