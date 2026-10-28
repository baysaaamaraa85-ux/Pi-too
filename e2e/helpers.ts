import { expect, type Page } from "@playwright/test";
import { E2E } from "./env.mjs";

export function uniquePhone(): string {
  return String(10_000_000 + Math.floor(Math.random() * 89_999_999));
}

export async function login(page: Page, identifier: string, password: string) {
  await page.goto("/login");
  await page.locator("#identifier").fill(identifier);
  await page.locator("#password").fill(password);
  await page.locator('form button[type="submit"]').click();
}

export async function loginAsAdmin(page: Page) {
  await login(page, E2E.adminPhone, E2E.adminPassword);
  await expect(page).toHaveURL(/\/admin$/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Гарах" }).first().click();
  await expect(page).not.toHaveURL(/\/(admin|teacher|portal)/);
}

// ФШ-03: түр нууц үгээр нэвтэрсэн хэрэглэгчийг нууц үг солих хуудас руу чиглүүлнэ.
export async function changeTemporaryPassword(
  page: Page,
  tempPassword: string,
  newPassword: string,
  expectedUrl: RegExp,
) {
  await expect(page).toHaveURL(/\/change-password/);
  await page.locator("#currentPassword").fill(tempPassword);
  await page.locator("#newPassword").fill(newPassword);
  await page.locator("#confirm").fill(newPassword);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(expectedUrl);
}

export interface Creds {
  identifier: string;
  password: string;
}

// Хэрэглэгч үүсгэсний дараа цонхонд харагдах нэвтрэх нэр, түр нууц үгийг уншина.
export async function readCredentials(page: Page, index = 0): Promise<Creds> {
  const card = page.getByTestId("credentials").nth(index);
  await expect(card).toBeVisible();
  const identifier = (await card.getByTestId("cred-identifier").textContent()) ?? "";
  const password = (await card.getByTestId("cred-password").textContent()) ?? "";
  return { identifier: identifier.trim(), password: password.trim() };
}
