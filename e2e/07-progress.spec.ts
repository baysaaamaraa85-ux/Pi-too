import { expect, test } from "@playwright/test";
import { createTeacherWithClasses, enrollViaApi, insertLesson, weekdaysExceptToday } from "./api-helpers";
import { login, uniquePhone } from "./helpers";

async function setup(request: import("@playwright/test").APIRequestContext) {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const lessonId = await insertLesson(teacher.classIds[0]!, teacher.teacherId, 10);
  const name = `Явцын сурагч ${uniquePhone()}`;
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { studentId: string };
  return { teacher, lessonId, name, studentId: body.studentId };
}

async function openDetail(page: import("@playwright/test").Page, teacher: { phone: string; password: string }, studentId: string) {
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto(`/teacher/students/${studentId}`);
}

test("багш сорил бүртгэхэд график, сул сэдэв гарч, багцын шалгалт 92.9% үнэгүй давтлагын эрх үүсгэнэ", async ({
  page,
  request,
}) => {
  const { teacher, studentId } = await setup(request);
  await openDetail(page, teacher, studentId);

  // Сорил, сэдвийн оноотой: 55% ба 65%, дундаж 60%.
  await page.getByRole("button", { name: "Сорил, шалгалт бүртгэх" }).click();
  await page.getByRole("button", { name: "Сэдэв нэмэх" }).click();
  await page.getByRole("button", { name: "Сэдэв нэмэх" }).click();
  await page.getByLabel("Сэдэв 1", { exact: true }).fill("Бутархай");
  await page.getByLabel("Оноо 1").fill("55");
  await page.getByLabel("Сэдэв 2", { exact: true }).fill("Хувь");
  await page.getByLabel("Оноо 2").fill("65");
  await page.getByRole("button", { name: "Бүртгэх", exact: true }).click();
  await expect(page.getByTestId("assessment-result")).toContainText("60%");
  await page.getByRole("button", { name: "Хаах" }).last().click();

  await expect(page.getByTestId("chart-point")).toHaveCount(1);
  await expect(page.getByTestId("weak-topics")).toContainText("Бутархай");
  await expect(page.getByTestId("weak-topics")).not.toContainText("Хувь");

  // Багцын шалгалт 92.9%: 3 үнэгүй давтлагын эрх.
  await page.getByRole("button", { name: "Сорил, шалгалт бүртгэх" }).click();
  await page.getByLabel("Төрөл").selectOption("BATCH_EXAM");
  await page.getByLabel("Нийт хувь (0-100)").fill("92.9");
  await page.getByRole("button", { name: "Бүртгэх", exact: true }).click();
  await expect(page.getByTestId("assessment-result")).toContainText("92.9%");
  await expect(page.getByRole("dialog")).toContainText("3 үнэгүй давтлагын эрх");
  await page.getByRole("button", { name: "Хаах" }).last().click();
  await expect(page.getByTestId("chart-point")).toHaveCount(2);
});

test("ФШ-44, 45: багш хичээлийн тэмдэглэл бичиж, эцэг эхтэй уулзсанаа бүртгэнэ", async ({ page, request }) => {
  const { teacher, lessonId, name, studentId } = await setup(request);
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto(`/teacher/attendance/${lessonId}`);

  const row = page.getByTestId("attendance-row").filter({ hasText: name });
  await row.getByRole("button", { name: "Тэмдэглэл" }).click();
  await page.getByLabel("Харагдах эрх").selectOption("SHARED");
  await page.getByLabel("Тэмдэглэл", { exact: true }).fill("Тригонометр сайн ойлгосон");
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();

  await page.goto(`/teacher/students/${studentId}`);
  await expect(page.getByTestId("notes-list")).toContainText("Тригонометр сайн ойлгосон");
  await expect(page.getByTestId("notes-list")).toContainText("Хуваалцсан");

  await page.getByRole("button", { name: "Уулзалт бүртгэх" }).click();
  await page.getByLabel("Дүгнэлт").fill("Явц сайн");
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(page.getByText("Эцэг эхтэй уулзалт (1)")).toBeVisible();
});

test.describe("ФБШ-10: утасны дэлгэц", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("сурагчийн явцын хуудас 360 px-д хэвтээ гүйлгэлтгүй", async ({ page, request }) => {
    const { teacher, studentId } = await setup(request);
    await openDetail(page, teacher, studentId);
    await page.getByRole("button", { name: "Сорил, шалгалт бүртгэх" }).click();
    await page.getByLabel("Нийт хувь (0-100)").fill("80");
    await page.getByRole("button", { name: "Бүртгэх", exact: true }).click();
    await page.getByRole("button", { name: "Хаах" }).last().click();
    await expect(page.getByTestId("chart-point")).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
