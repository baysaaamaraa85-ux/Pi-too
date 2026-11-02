import { expect, test, type APIRequestContext } from "@playwright/test";
import { apiLogin, bearer, createTeacherWithClasses, enrollViaApi, weekdaysExceptToday } from "./api-helpers";
import { login, uniquePhone } from "./helpers";

// ФШ-65...67, ФБШ-10: эцэг эх, сурагчийн портал 360 px утсан дээр.
test.use({ viewport: { width: 360, height: 640 } });

interface Family {
  studentName: string;
  parentPhone: string;
  parentPassword: string;
  studentPhone: string;
  studentPassword: string;
}

async function newPassword(request: APIRequestContext, phone: string, temp: string, next: string) {
  const first = await apiLogin(request, phone, temp);
  const res = await request.post("/api/v1/auth/password/change", {
    headers: bearer(first.token),
    data: { currentPassword: temp, newPassword: next },
  });
  expect(res.status()).toBe(204);
}

async function setup(request: APIRequestContext): Promise<Family> {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const studentName = `Порталын сурагч ${uniquePhone()}`;
  const parentPhone = uniquePhone();
  const studentPhone = uniquePhone();
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, {
    studentName,
    parentPhone,
    studentPhone,
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { tempPassword: string; studentTempPassword: string };
  const parentPassword = "EtsegPortal123!";
  const studentPassword = "SuragchPortal123!";
  await newPassword(request, parentPhone, body.tempPassword, parentPassword);
  await newPassword(request, studentPhone, body.studentTempPassword, studentPassword);
  return { studentName, parentPhone, parentPassword, studentPhone, studentPassword };
}

test("ФШ-65: эцэг эхийн нүүр дөрвөн үзүүлэлтийг 360x640 дэлгэцэд гүйлгэхгүйгээр харуулна", async ({ page, request }) => {
  const f = await setup(request);
  await login(page, f.parentPhone, f.parentPassword);
  await expect(page).toHaveURL(/\/portal$/);

  const ids = ["stat-remaining", "stat-leaves", "stat-next-lesson", "stat-last-assessment"];
  for (const id of ids) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("stat-remaining")).toContainText("/");
  await expect(page.getByTestId("stat-leaves")).toContainText("3");
  await expect(page.getByTestId("stat-next-lesson")).not.toContainText("Алга");

  const viewport = page.viewportSize()!;
  for (const id of ids) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box!.y + box!.height, `${id} дэлгэцийн доор`).toBeLessThanOrEqual(viewport.height);
    expect(box!.x + box!.width, `${id} дэлгэцийн баруун талд`).toBeLessThanOrEqual(viewport.width);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("ФШ-66: сурагч төлбөрийн хэсгийг харахгүй, эцэг эх 'Гэрээ, төлбөр' хуудсыг нээнэ", async ({ page, request }) => {
  const f = await setup(request);

  await login(page, f.studentPhone, f.studentPassword);
  await expect(page).toHaveURL(/\/portal$/);
  const nav = page.getByRole("navigation", { name: "Үндсэн цэс" }).last();
  await expect(nav.getByRole("link", { name: "Төлбөр" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Гэрээ, төлбөр" })).toHaveCount(0);
  await page.goto("/portal/payment");
  await expect(page).toHaveURL(/\/portal$/);
  await page.getByRole("button", { name: "Гарах" }).first().click();

  await login(page, f.parentPhone, f.parentPassword);
  await expect(page).toHaveURL(/\/portal$/);
  await page.getByRole("navigation", { name: "Үндсэн цэс" }).last().getByRole("link", { name: "Төлбөр" }).click();
  await expect(page.getByRole("heading", { name: "Гэрээ, төлбөр" })).toBeVisible();
});

test("ФШ-67, ФБШ-10: ирц ба дүн хуудас 360 px-д хэвтээ гүйлгэлтгүй, дүнгийн хэсэгтэй, сурагч өөрийнхөө ирцийг харна", async ({
  page,
  request,
}) => {
  const f = await setup(request);
  for (const [phone, password] of [
    [f.parentPhone, f.parentPassword],
    [f.studentPhone, f.studentPassword],
  ] as const) {
    await login(page, phone, password);
    await expect(page).toHaveURL(/\/portal$/);
    await page.getByRole("navigation", { name: "Үндсэн цэс" }).last().getByRole("link", { name: "Ирц" }).click();
    await expect(page.getByText("Сорил, шалгалтын дүн")).toBeVisible();
    await expect(page.getByText("Ирцийн түүх (багц бүрээр)")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Гарах" }).first().click();
    await expect(page).not.toHaveURL(/\/portal/);
  }
});
