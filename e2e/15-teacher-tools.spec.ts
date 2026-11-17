import { expect, test } from "@playwright/test";
import { bearer, createTeacherWithClasses, enrollViaApi, weekdaysExceptToday } from "./api-helpers";
import { login, uniquePhone } from "./helpers";

// D-69: багшийн хэрэгслүүд: категори, долоо хоногийн хуваарь, анги устгахдаа сурагч зөөх, заах чиглэл, 24 цагийн сонголт.

type Fixture = Awaited<ReturnType<typeof createTeacherWithClasses>>;

async function loginTeacher(page: import("@playwright/test").Page, t: Fixture) {
  await login(page, t.phone, t.password);
  await expect(page).toHaveURL(/\/teacher$/);
}

const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Багшийн цэс" });

test("D-69: багш өөрийн категори үүсгэж сурагчаа нэмэхэд самбарт категориор харагдана", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const name = `Категори ${uniquePhone()}`;
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name });
  expect(res.status()).toBe(201);

  await page.setViewportSize({ width: 1280, height: 900 });
  await loginTeacher(page, teacher);
  await expect(page.getByTestId("category-row")).toContainText("Ангилаагүй");

  await nav(page).getByRole("link", { name: "Сурагчид" }).click();
  await page.getByLabel("Шинэ категорийн нэр").fill("IGCSE");
  await page.getByRole("button", { name: "Категори нэмэх" }).click();
  await expect(page.getByTestId("category-chip")).toContainText("IGCSE");

  // Давхардсан нэр: алдаа.
  await page.getByLabel("Шинэ категорийн нэр").fill("IGCSE");
  await page.getByRole("button", { name: "Категори нэмэх" }).click();
  await expect(page.getByRole("alert").first()).toContainText("аль хэдийн");

  await page.getByLabel(`${name}: категори`).selectOption({ label: "IGCSE" });
  await expect(page.getByLabel(`${name}: категори`)).toHaveValue(/.+/);

  await page.goto("/teacher");
  await expect(page.getByTestId("category-row")).toHaveCount(1);
  await expect(page.getByTestId("category-row")).toContainText("IGCSE");
  await expect(page.getByTestId("category-total")).toHaveText("1");
});

test("D-69: хуваарь гаригаар, дүүргэлттэй; ангийг дарахад сурагчид төлбөрийн төлөвтэй нь popup-д гарна", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const name = `Хуваарь ${uniquePhone()}`;
  expect((await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name })).status()).toBe(201);

  await page.setViewportSize({ width: 1600, height: 900 });
  await loginTeacher(page, teacher);
  await nav(page).getByRole("link", { name: "Хуваарь" }).click();
  await expect(page.getByTestId("week-day")).toHaveCount(7);
  // Хоёр анги, тус бүр 1/6, 24 цагийн систем.
  await expect(page.getByTestId("week-class")).toHaveCount(2);
  await expect(page.getByTestId("week-class").first()).toContainText("10:00 - 12:00");
  await expect(page.getByTestId("week-fill").first()).toHaveText("1/6");
  await expect(page.getByTestId("week-schedule")).not.toContainText(/AM|PM/);

  // 7 гарагийг нэг нүүрэнд бүрэн харуулна (гүйлгэхгүй).
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByTestId("week-class").first().click();
  await expect(page.getByTestId("roster-student")).toHaveCount(1);
  await expect(page.getByTestId("roster-student")).toContainText(name);
  await expect(page.getByTestId("roster-student")).toContainText("Төлөгдөөгүй");
});

test("D-69: анги устгахад сурагчдыг харуулж, багш өөр сул зайтай анги руу зөөгөөд хоосон ангийг устгана", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(3));
  // Өөр багшийн сул анги: анги устгах цонхонд ХАРАГДАХГҮЙ (зөвхөн өөрийн ангиуд).
  const other = await createTeacherWithClasses(request, weekdaysExceptToday(1));
  const name = `Зөөх ${uniquePhone()}`;
  // Сурагч эхний хоёр ангид; гурав дахь анги сул.
  const res = await enrollViaApi(request, teacher.token, teacher.classIds.slice(0, 2), { studentName: name });
  expect(res.status()).toBe(201);

  await loginTeacher(page, teacher);
  await nav(page).getByRole("link", { name: "Анги" }).click();
  await expect(page.getByRole("button", { name: "Анги устгах" })).toHaveCount(3);

  // Сурагчтай анги: устгах товч идэвхгүй, сурагчийн нэр харагдана.
  await page.getByRole("button", { name: "Анги устгах" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("class-remaining")).toContainText("1 сурагч");
  await expect(dialog.getByTestId("move-row")).toContainText(name);
  await expect(dialog.getByRole("button", { name: "Анги устгах" })).toBeDisabled();

  // Гурав дахь (сул) анги руу зөөнө.
  const select = dialog.getByLabel(`${name}: шинэ анги`);
  const options = await select.locator("option").all();
  expect(options.length).toBeGreaterThan(1);
  const labels = await select.locator("option").allTextContents();
  expect(labels.filter((l) => l.includes(`Багш ${other.phone}`))).toHaveLength(0);
  expect(labels.filter((l) => l.includes(`Багш ${teacher.phone}`)).length).toBe(labels.length - 1);
  await select.selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Зөөх" }).click();
  await expect(dialog.getByTestId("class-empty")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Анги устгах" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Анги устгах" }).click();
  await expect(dialog).toHaveCount(0);

  // Сурагч өөр ангид хэвээр: хуваарьт 2 анги (нэг нь шинээр зөөгдсөн).
  await nav(page).getByRole("link", { name: "Хуваарь" }).click();
  await expect(page.getByTestId("week-class")).toHaveCount(2);
});

test("D-69: анги үүсгэх цагийн сонголт 24 цагийн систем (00-23), AM/PM байхгүй", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, []);
  await loginTeacher(page, teacher);
  await nav(page).getByRole("link", { name: "Анги" }).click();
  const hours = page.getByLabel("Эхлэх цаг: цаг");
  await expect(hours.locator("option")).toHaveCount(24);
  await expect(hours.locator("option").last()).toHaveText("23");
  await expect(page.getByRole("main")).not.toContainText(/AM|PM/);
  await hours.selectOption("18");
  await page.getByLabel("Эхлэх цаг: минут").selectOption("30");
  await page.getByLabel("Салбар", { exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Анги үүсгэх" }).click();
  await expect(page.getByText(/· 18:30/)).toBeVisible();
});

test("D-69: багш өөрийн заах чиглэлийг профайлаасаа бичиж, нийтийн сайтад харагдана", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, []);
  await loginTeacher(page, teacher);
  await page.getByRole("link", { name: "Миний профайл" }).first().click();
  await expect(page).toHaveURL(/\/teacher\/profile$/);

  await page.getByLabel("Чиглэл нэмэх").fill("IB математик");
  await page.getByRole("button", { name: "Нэмэх", exact: true }).click();
  await page.getByRole("button", { name: "+ ЭЕШ" }).click();
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByTestId("specialties-saved")).toBeVisible();

  const list = (await (await request.get("/api/v1/public/teachers")).json()) as { id: string; specialties: string[] }[];
  expect(list.find((t) => t.id === teacher.teacherId)?.specialties).toEqual(["IB математик", "ЭЕШ"]);

  await page.goto("/teachers");
  const card = page.getByRole("listitem").filter({ hasText: `Багш ${teacher.phone}` }).first();
  await expect(card).toContainText("IB математик");
  await expect(card).toContainText("ЭЕШ");

  // BOLA: өөр багшийн чиглэлийг API-аар засах боломжгүй.
  const other = await createTeacherWithClasses(request, []);
  const denied = await request.patch(`/api/v1/teachers/${other.teacherId}/specialties`, {
    headers: bearer(teacher.token),
    data: { specialties: ["Хакер"] },
  });
  expect(denied.status()).toBe(403);
});

test("D-69, D-73: багш солих бол сурагчийн картаас Шилжүүлэх: бүх цагийг бусад багшийн цагаас сонгоно", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const other = await createTeacherWithClasses(request, weekdaysExceptToday(1));
  const name = `Багш солих ${uniquePhone()}`;
  expect((await enrollViaApi(request, teacher.token, teacher.classIds, { studentName: name })).status()).toBe(201);

  await loginTeacher(page, teacher);
  await nav(page).getByRole("link", { name: "Сурагчид" }).click();
  const card = page.getByTestId("student-card").filter({ hasText: name });
  // Картад ангиар тусдаа товч алга: нэг л "Шилжүүлэх".
  await expect(card.getByRole("button", { name: "Шилжүүлэх" })).toHaveCount(1);
  await card.getByRole("button", { name: "Шилжүүлэх" }).click();

  const dialog = page.getByRole("dialog");
  // Сурагчийн хоёр цаг тус бүр өөрийн сонголттой; бусад бүх багш харагдана.
  const selects = dialog.getByRole("combobox", { name: /Шинэ цаг/ });
  await expect(selects).toHaveCount(2);
  const labels = await selects.first().locator("option").allTextContents();
  const target = labels.find((l) => l.includes(`Багш ${other.phone}`));
  expect(target).toBeTruthy();
  await selects.first().selectOption({ label: target! });
  await dialog.getByLabel("Шалтгаан").fill("Багш солив");
  await dialog.getByRole("button", { name: /^Шилжүүлэх/ }).click();
  await expect(dialog).toHaveCount(0);

  // Сурагч шинэ багшийн ангид бүртгэгдсэн (картан дээр багшийн нэр гарна).
  await expect(card).toContainText(`Багш ${other.phone}`);
});

