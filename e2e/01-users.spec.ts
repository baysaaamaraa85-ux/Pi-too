import { expect, test } from "@playwright/test";
import {
  changeTemporaryPassword,
  loginAsAdmin,
  login,
  logout,
  readCredentials,
  uniquePhone,
} from "./helpers";

// Шинэ шаардлага 1.2, 1.3: админ багш, эцэг эх, сурагч үүсгэнэ, тус бүр түр нууц үгээр
// нэвтэрч, нууц үгээ солиод өөрийн хэсэгт ордог (ФШ-02, 03).
test("админ багш үүсгэнэ, багш түр нууц үгээр нэвтэрч нууц үг солино", async ({ page }) => {
  await loginAsAdmin(page);
  const phone = uniquePhone();
  const name = `Багш ${phone}`;

  await page.getByRole("link", { name: "Багш нар" }).first().click();
  await page.getByRole("button", { name: "Багш нэмэх" }).click();
  await page.getByLabel("Бүтэн нэр").fill(name);
  await page.getByLabel("Утасны дугаар (нэвтрэх нэр)").fill(phone);
  await page.getByRole("button", { name: "Багш үүсгэх" }).click();

  const creds = await readCredentials(page);
  expect(creds.identifier).toBe(phone);
  await page.getByRole("button", { name: "Хаах", exact: true }).last().click();

  // Хуудас дахин ачаалахгүйгээр жагсаалтад гарна.
  await page.getByLabel("Нэр, утасаар хайх").fill(phone);
  await expect(page.getByRole("link", { name }).first()).toBeVisible();

  await logout(page);

  await login(page, creds.identifier, creds.password);
  await changeTemporaryPassword(page, creds.password, "BagshNew123!", /\/teacher$/);
  await expect(page.getByRole("button", { name: "Гарах" }).first()).toBeVisible();

  // Шинэ нууц үгээр дахин нэвтэрнэ, нууц үг солих шаардахгүй.
  await logout(page);
  await login(page, phone, "BagshNew123!");
  await expect(page).toHaveURL(/\/teacher$/);
});

test("админ сурагч, эцэг эхийг үүсгэхэд тус бүр өөрийн /portal хэсэгт нэвтэрнэ", async ({ page }) => {
  await loginAsAdmin(page);
  const parentPhone = uniquePhone();
  const studentPhone = uniquePhone();
  const studentName = `Сурагч ${studentPhone}`;

  await page.getByRole("link", { name: "Сурагчид" }).first().click();
  await page.getByRole("button", { name: "Сурагч нэмэх" }).click();
  await page.getByLabel("Эцэг эхийн утас", { exact: true }).fill(parentPhone);
  await page.getByLabel("Эцэг эхийн бүтэн нэр (шинэ данс)").fill("Шинэ Эцэг");
  await page.getByLabel("Сурагчийн бүтэн нэр").fill(studentName);
  await page.getByLabel("Сурагчид данс үүсгэх").check();
  await page.getByLabel("Сурагчийн утас (нэвтрэх нэр)").fill(studentPhone);
  await page.getByRole("button", { name: "Сурагч үүсгэх" }).click();

  const parent = await readCredentials(page, 0);
  const student = await readCredentials(page, 1);
  expect(parent.identifier).toBe(parentPhone);
  expect(student.identifier).toBe(studentPhone);
  await page.getByRole("button", { name: "Хаах", exact: true }).last().click();

  await page.getByLabel("Нэр, эцэг эхийн утасаар хайх").fill(parentPhone);
  await expect(page.getByRole("link", { name: studentName })).toBeVisible();

  // Эцэг эхийн жагсаалтад шууд гарна.
  await page.getByRole("link", { name: "Эцэг эхчүүд" }).first().click();
  await page.getByLabel("Нэр, утас, хүүхдийн нэрээр хайх").fill(parentPhone);
  await expect(page.getByRole("link", { name: "Шинэ Эцэг" })).toBeVisible();
  await expect(page.getByText(studentName).first()).toBeVisible();

  await logout(page);
  await login(page, parent.identifier, parent.password);
  await changeTemporaryPassword(page, parent.password, "EtsegNew123!", /\/portal$/);
  await logout(page);

  await login(page, student.identifier, student.password);
  await changeTemporaryPassword(page, student.password, "SuragchNew123!", /\/portal$/);
});

test("багш админы хэсэгт орж чадахгүй (ФШ-02)", async ({ page }) => {
  await loginAsAdmin(page);
  const phone = uniquePhone();
  await page.getByRole("link", { name: "Багш нар" }).first().click();
  await page.getByRole("button", { name: "Багш нэмэх" }).click();
  await page.getByLabel("Бүтэн нэр").fill("Хаалттай багш");
  await page.getByLabel("Утасны дугаар (нэвтрэх нэр)").fill(phone);
  await page.getByRole("button", { name: "Багш үүсгэх" }).click();
  const creds = await readCredentials(page);
  await page.getByRole("button", { name: "Хаах", exact: true }).last().click();
  await logout(page);

  await login(page, creds.identifier, creds.password);
  await changeTemporaryPassword(page, creds.password, "BagshNew123!", /\/teacher$/);
  await page.goto("/admin/teachers");
  await expect(page).not.toHaveURL(/\/admin\/teachers/);
});
