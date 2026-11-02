import { expect, test, type APIRequestContext } from "@playwright/test";
import { apiLogin, bearer, createTeacherWithClasses, enrollViaApi, weekdaysExceptToday } from "./api-helpers";
import { login, loginAsAdmin, logout, uniquePhone } from "./helpers";

interface ParentFixture {
  studentName: string;
  parentPhone: string;
  parentPassword: string;
  contractId: string;
}

// Багш сурагч бүртгэнэ, эцэг эх шинэ данс авна, түр нууц үгээ API-аар солино.
async function setup(request: APIRequestContext): Promise<ParentFixture & { teacherToken: string }> {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const studentName = `Төлбөрийн сурагч ${uniquePhone()}`;
  const parentPhone = uniquePhone();
  const res = await enrollViaApi(request, teacher.token, teacher.classIds, { studentName, parentPhone });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { tempPassword: string; contractId: string };

  const first = await apiLogin(request, parentPhone, body.tempPassword);
  const parentPassword = "EtsegE2e123!";
  const change = await request.post("/api/v1/auth/password/change", {
    headers: bearer(first.token),
    data: { currentPassword: body.tempPassword, newPassword: parentPassword },
  });
  expect(change.status()).toBe(204);
  return { studentName, parentPhone, parentPassword, contractId: body.contractId, teacherToken: teacher.token };
}

test("эцэг эх Шилжүүлсэн дарахад админы жагсаалтад гарч, батлахад төлөв шинэчлэгдэнэ", async ({ page, request }) => {
  const f = await setup(request);

  // 1. Эцэг эх: Төлөгдөөгүй -> Шилжүүлсэн -> Хүлээгдэж байна.
  await login(page, f.parentPhone, f.parentPassword);
  await expect(page).toHaveURL(/\/portal$/);
  await page.getByRole("navigation", { name: "Үндсэн цэс" }).first().getByRole("link", { name: "Төлбөр" }).click();
  await expect(page.getByTestId("payment-status")).toContainText("Төлөгдөөгүй");
  await page.getByRole("button", { name: "Төлбөр төлөх" }).click();
  await expect(page.getByRole("dialog")).toContainText(f.studentName);
  await page.getByRole("button", { name: "Шилжүүлсэн" }).click();
  await expect(page.getByRole("button", { name: "Хүлээгдэж байна" })).toBeVisible();
  await page.getByRole("button", { name: "Хаах" }).first().click();
  await expect(page.getByTestId("payment-status")).toContainText("Хүлээгдэж байна");
  await logout(page);

  // 2. Админ: хүлээгдэж буй жагсаалтад гарна, 400 000 ₮ гэж батална.
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Төлбөр" }).first().click();
  const claim = page.getByTestId("claim").filter({ hasText: f.studentName });
  await expect(claim).toBeVisible();
  await claim.getByRole("button", { name: "Батлах" }).click();
  await page.getByLabel("Дүн (₮)").fill("400000");
  await page.getByRole("button", { name: "Баталгаажуулах" }).click();
  await expect(page.getByTestId("claim").filter({ hasText: f.studentName })).toHaveCount(0);

  // Админы сурагчийн жагсаалтад төлөв шинэчлэгдсэн.
  await page.getByRole("link", { name: "Сурагчид" }).first().click();
  await page.getByLabel("Нэр, эцэг эхийн утасаар хайх").fill(f.parentPhone);
  const row = page.getByRole("row").filter({ hasText: f.studentName });
  await expect(row.getByTestId("payment-cell")).toContainText("Дутуу төлөгдсөн");
  await logout(page);

  // 3. Эцэг эхийн карт шинэчлэгдсэн: Дутуу төлөгдсөн, үлдэгдэл 800 000 ₮.
  await login(page, f.parentPhone, f.parentPassword);
  await expect(page).toHaveURL(/\/portal$/);
  await page.getByRole("navigation", { name: "Үндсэн цэс" }).first().getByRole("link", { name: "Төлбөр" }).click();
  await expect(page.getByTestId("payment-status")).toContainText("Дутуу төлөгдсөн");
  await expect(page.getByTestId("payment-status")).toContainText("Үлдэгдэл 800 000 ₮");
});

test("ФШ-48, 52: өртэй гэрээнээс төлбөр бүртгэж, цуцлахад өр буцаж гарна", async ({ page, request }) => {
  const f = await setup(request);
  await loginAsAdmin(page);
  await page.goto("/admin/payments");
  await page.getByRole("tab", { name: "Өртэй гэрээ" }).click();
  // 20 мөрийн хуудаслалтаас гарахын тулд (өмнөх тестүүд өртэй гэрээ үлдээдэг) хайна.
  await page.getByLabel("Сурагч, эцэг эхийн нэр, утасаар хайх").fill(f.studentName);

  const row = page.getByRole("row").filter({ hasText: f.studentName });
  await expect(row.getByTestId("debt-balance")).toHaveText("1 200 000 ₮");
  await row.getByRole("button", { name: "Төлбөр бүртгэх" }).click();
  await page.getByLabel("Дүн (₮)").fill("1200000");
  await page.getByLabel("Гүйлгээний утга").fill("Хаан банк e2e");
  await page.getByRole("button", { name: "Бүртгэх", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: f.studentName })).toHaveCount(0);

  await page.getByRole("tab", { name: "Төлбөрийн бүртгэл" }).click();
  await page.getByLabel("Сурагчийн нэрээр хайх").fill(f.studentName);
  const pay = page.getByRole("row").filter({ hasText: f.studentName });
  await expect(pay.getByTestId("payment-amount")).toHaveText("1 200 000 ₮");
  await pay.getByRole("button", { name: "Цуцлах" }).click();
  await page.getByLabel("Цуцлах шалтгаан (заавал)").fill("Буруу гэрээ");
  await page.getByRole("dialog").getByRole("button", { name: "Цуцлах" }).click();
  await expect(page.getByRole("row").filter({ hasText: f.studentName })).toContainText("Цуцалсан: Буруу гэрээ");

  await page.getByRole("tab", { name: "Өртэй гэрээ" }).click();
  await page.getByLabel("Сурагч, эцэг эхийн нэр, утасаар хайх").fill(f.studentName);
  await expect(page.getByRole("row").filter({ hasText: f.studentName }).getByTestId("debt-balance")).toHaveText(
    "1 200 000 ₮",
  );
});

test.describe("ФБШ-10: утасны дэлгэц", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("Төлбөрийн хуудас 360 px-д хэвтээ гүйлгэлтгүй", async ({ page }) => {
    await loginAsAdmin(page);
    for (const tab of ["Хүлээгдэж буй төлбөр", "Өртэй гэрээ", "Төлбөрийн бүртгэл"]) {
      await page.goto("/admin/payments");
      await page.getByRole("tab", { name: tab }).click();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, tab).toBeLessThanOrEqual(0);
    }
  });
});
