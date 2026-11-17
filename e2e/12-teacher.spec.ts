import { expect, test } from "@playwright/test";
import {
  backdateEnrollment,
  bearer,
  createTeacherWithClasses,
  enrollViaApi,
  insertLesson,
  weekdaysExceptToday,
} from "./api-helpers";
import { login, uniquePhone } from "./helpers";

// Багшийн аялал: утсан дээр (360 px), багшийн нүдээр.
test.use({ viewport: { width: 360, height: 740 } });

async function loginTeacher(page: import("@playwright/test").Page, t: { phone: string; password: string }) {
  await login(page, t.phone, t.password);
  await expect(page).toHaveURL(/\/teacher$/);
}

const nav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Үндсэн цэс" }).last();

test("ФШ-19, 25: багш анги үүсгэж, давхцсан цагт сервер татгалзаж, ангийг устгана", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, []);
  await loginTeacher(page, teacher);
  await nav(page).getByRole("link", { name: "Анги" }).click();

  const create = async () => {
    await page.getByLabel("Салбар", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Гараг", { exact: true }).selectOption("3");
    // 24 цагийн сонголт (AM/PM-гүй): цаг, минутыг тусад нь.
    await page.getByLabel("Эхлэх цаг: цаг").selectOption("10");
    await page.getByLabel("Эхлэх цаг: минут").selectOption("00");
    await page.getByRole("button", { name: "Анги үүсгэх" }).click();
  };
  await create();
  await expect(page.getByText("Лхагва · 10:00")).toBeVisible();

  // Яг ижил цаг: давхцал.
  await create();
  await expect(page.getByRole("alert")).toContainText("өөр ангитай");
  await expect(page.getByText("Лхагва · 10:00")).toHaveCount(1);

  await page.getByRole("button", { name: "Анги устгах" }).click();
  await expect(page.getByTestId("class-empty")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Анги устгах" }).click();
  await expect(page.getByText("Лхагва · 10:00")).toHaveCount(0);
});

test("ФШ-24: багш хуваариас хичээлээ цуцалж, цуцлагдсан гэж харагдана", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  await loginTeacher(page, teacher);
  await nav(page).getByRole("link", { name: "Хуваарь" }).click();
  // Үндсэн харагдац нь долоо хоногоор (D-69). Хичээл цуцлах нь "Ирэх хичээлүүд" табд.
  await page.getByRole("tab", { name: "Ирэх хичээлүүд" }).click();

  const first = page.getByRole("button", { name: "Цуцлах", exact: true }).first();
  await expect(first).toBeVisible();
  await first.click();
  await page.getByRole("dialog").getByRole("button", { name: "Цуцлах" }).click();
  await expect(page.getByText("Цуцлагдсан").first()).toBeVisible();
});

test("ФШ-18: багш сурагчийн хувийн төлөвлөгөөг сэдвээр бүртгэж, дахин нээхэд хадгалагдсан байна", async ({
  page,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const name = `Төлөвлөгөөт ${uniquePhone()}`;
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name });
  expect(res.status()).toBe(201);

  await loginTeacher(page, teacher);
  await nav(page).getByRole("link", { name: "Сурагчид" }).click();
  const card = page.getByTestId("student-card").filter({ hasText: name });
  await card.getByRole("button", { name: "Төлөвлөгөө" }).click();
  await page.getByLabel("Сэдэв 1").fill("Бутархай");
  await page.getByRole("button", { name: "Сэдэв нэмэх" }).click();
  await page.getByLabel("Сэдэв 2").fill("Тэгшитгэл");
  await page.getByRole("dialog").getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await card.getByRole("button", { name: "Төлөвлөгөө" }).click();
  await expect(page.getByLabel("Сэдэв 1")).toHaveValue("Бутархай");
  await expect(page.getByLabel("Сэдэв 2")).toHaveValue("Тэгшитгэл");
});

test("ФШ-03: багш толгойн 'Нууц үг' холбоосоор нууц үгээ сайн дураараа солино", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  await loginTeacher(page, teacher);
  await page.getByRole("link", { name: "Нууц үг" }).click();
  await expect(page).toHaveURL(/\/change-password$/);
});

// ФБШ-10: утсан дээр багшийн хуудас бүрийн товч, талбар 44 px-ээс багагүй, хэвтээ гүйлгэлтгүй.
test("ФБШ-10: багшийн бүх хуудсанд хүрэх товч, талбар 44 px-ээс багагүй", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const lessonId = await insertLesson(teacher.classIds[0]!, teacher.teacherId, 10);
  const name = `Хэмжих ${uniquePhone()}`;
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { contractId: string; studentId: string };
  await backdateEnrollment(body.contractId);

  await loginTeacher(page, teacher);
  const paths = [
    "/teacher",
    "/teacher/calendar",
    "/teacher/classes",
    "/teacher/students",
    `/teacher/students/${body.studentId}`,
    `/teacher/attendance/${lessonId}`,
    "/teacher/salary",
    "/teacher/enroll",
    "/teacher/profile",
  ];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const small = await page.evaluate(() => {
      const els = document.querySelectorAll<HTMLElement>(
        "main button, main select, main input:not([type=checkbox]):not([type=radio]):not([type=file]), header button, header a, nav a",
      );
      const bad: string[] = [];
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        if (rect.height < 43.5) {
          bad.push(`${el.tagName} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}" ${Math.round(rect.height)}px`);
        }
      }
      return bad;
    });
    expect(small, path).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} хэвтээ гүйлгэлт`).toBeLessThanOrEqual(0);
  }
});

// Багшийн нүүр (дизайн): мэндчилгээ, дөрвөн үзүүлэлт, хажуугийн цэс, сурагчдын ахицын график.
test("Багшийн нүүр: нэртэй мэндчилгээ, дөрвөн үзүүлэлт, хажуугийн цэс, ахицын график", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, {
    studentName: `Ахицтай ${uniquePhone()}`,
  });
  const body = (await res.json()) as { contractId: string; studentId: string };
  const today = new Date().toISOString().slice(0, 10);
  for (const [takenOn, totalPercent] of [
    [today, 80],
    [today, 60],
  ] as const) {
    const r = await request.post(`/api/v1/students/${body.studentId}/assessments`, {
      headers: bearer(teacher.token),
      data: { type: "QUIZ", takenOn, totalPercent, contractId: body.contractId },
    });
    expect(r.status()).toBe(201);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await loginTeacher(page, teacher);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Багш ${teacher.phone} багшдаа`);
  await expect(page.getByTestId("stat-students")).toContainText("1");
  await expect(page.getByTestId("stat-lessons")).toBeVisible();
  await expect(page.getByTestId("stat-attendance")).toBeVisible();
  await expect(page.getByTestId("stat-unfilled")).toContainText("0");

  // Нэг дэлгэцэнд багтана (гүйлгэхгүй): 1280x800.
  const [scrollHeight, innerHeight] = await page.evaluate(() => [
    document.documentElement.scrollHeight,
    window.innerHeight,
  ]);
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight);

  const sidebar = page.getByRole("navigation", { name: "Багшийн цэс" });
  for (const label of ["Өнөөдөр", "Хуваарь", "Анги", "Сурагчид", "Цалин"]) {
    await expect(sidebar.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(page.getByTestId("sidebar-name")).toContainText(`Багш ${teacher.phone}`);

  // Категори: сурагч хөтөлбөрөөр (Бүгд = 1).
  await expect(page.getByTestId("category-total")).toHaveText("1");
  await expect(page.getByTestId("category-row")).toHaveCount(1);
  // Хонх: ирц бөглөөгүй хичээл, сануулга байхгүй тул цэггүй. Хайлт сурагчийн жагсаалт руу.
  await expect(page.getByTestId("bell-dot")).toHaveCount(0);
  // Нэг сарын дундаж (80 ба 60) = 70%.
  await expect(page.getByTestId("trend-point")).toHaveCount(1);
  await expect(page.getByTestId("trend-chart")).toContainText("70%");

  // 7 хоног руу шилжүүлэхэд өнөөдрийн цэг хэвээр.
  await page.getByRole("button", { name: "7 хоног" }).click();
  await expect(page.getByTestId("trend-chart")).toContainText("70%");

  // Дээд мөрний хайлт сурагчийн жагсаалтыг нэрээр шүүнэ.
  await page.getByLabel("Сурагч хайх").fill("Ахицтай");
  await page.getByLabel("Сурагч хайх").press("Enter");
  await expect(page).toHaveURL(/\/teacher\/students\?q=/);
  await expect(page.getByLabel("Сурагчийн нэрээр хайх")).toHaveValue("Ахицтай");
  await page.goto("/teacher");

  // Хажуугийн цэсээр шилжинэ.
  await sidebar.getByRole("link", { name: "Сурагчид" }).click();
  await expect(page).toHaveURL(/\/teacher\/students$/);
});
