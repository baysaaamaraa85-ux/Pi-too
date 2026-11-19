import { expect, test, type APIRequestContext } from "@playwright/test";
import { apiAsAdmin, bearer, createTeacherWithClasses } from "./api-helpers";
import { login, loginAsAdmin, logout, uniquePhone } from "./helpers";

// D-102: салбарын ахлагч. Админ салбар бүрээс нэг багшийг ахлагчаар томилно, нийтийн сайтаас ирсэн түвшин тогтоох
// хүсэлт тэр багшид очно. Ахлагч эцэг эхтэй холбогдож, салбар дээрээ байхгүй бол салбарын өөр багшид шилжүүлнэ.

async function newBranchWithTeachers(request: APIRequestContext) {
  const admin = await apiAsAdmin(request);
  const name = `Ахлагчийн салбар ${uniquePhone()}`;
  const branch = await request.post("/api/v1/branches", {
    headers: bearer(admin.token),
    data: { name, address: "Сүхбаатар дүүрэг, 1-р хороо" },
  });
  expect(branch.status()).toBe(201);
  const branchId = ((await branch.json()) as { id: string }).id;

  const teachers = [];
  for (const _ of [0, 1]) {
    const t = await createTeacherWithClasses(request, []);
    // Багш тухайн салбарт анги заадаг байх ёстой (ахлагчаар зөвхөн тэр салбарын багшийг томилно).
    const cls = await request.post("/api/v1/classes", {
      headers: bearer(t.token),
      data: { branchId, weekday: 2, startTime: "10:00" },
    });
    expect(cls.status()).toBe(201);
    teachers.push(t);
  }
  return { name, branchId, teachers: teachers as [(typeof teachers)[number], (typeof teachers)[number]] };
}

test("D-102: админ ахлагч томилно, хүсэлт ахлагчид очиж, ахлагч салбарын өөр багшид шилжүүлнэ", async ({ page, request }) => {
  const { name, branchId, teachers } = await newBranchWithTeachers(request);
  const [lead, colleague] = teachers;
  const studentName = `Хүсэлтийн сурагч ${uniquePhone()}`;

  // 1. Админ салбарын ахлагчийг админ хэсгээс томилно.
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/catalog");
  const row = page.getByTestId("branch-row").filter({ hasText: name });
  // Сонголт серверт хадгалагдахыг (PUT) хүлээнэ, эс бөгөөс доор гарахад хадгалалт тасарна.
  const saved = page.waitForResponse((r) => r.url().includes(`/branches/${branchId}/lead`) && r.request().method() === "PUT");
  await row.getByLabel("Салбарын ахлагч").selectOption({ label: `Багш ${lead.phone}` });
  expect((await saved).status()).toBe(200);
  await expect(row.getByLabel("Салбарын ахлагч")).toHaveValue(lead.teacherId);
  await logout(page);

  // 2. Нийтийн сайтаас хүсэлт ирнэ (нэвтрэлтгүй).
  const created = await request.post("/api/v1/public/placement-requests", {
    data: { studentName, phone: "99112299", branchId },
  });
  expect(created.status()).toBe(201);

  // 3. Ахлагч хүсэлтээ өөрийн хуудаснаас харна, бусад багш харахгүй.
  await login(page, lead.phone, lead.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto("/teacher/placement-requests");
  await expect(page.getByTestId("lead-note")).toBeVisible();
  const card = page.getByTestId("placement-request").filter({ hasText: studentName });
  await expect(card).toBeVisible();
  await expect(card.getByTestId("placement-assignee")).toContainText(`Багш ${lead.phone}`);

  // 4. Салбар дээрээ байхгүй тул салбарын өөр багшид шилжүүлнэ.
  await card.getByTestId("forward-open").click();
  await page.getByLabel("Шилжүүлэх багш").selectOption({ label: `Багш ${colleague.phone}` });
  await page.getByTestId("forward-confirm").click();
  await expect(card.getByTestId("placement-assignee")).toContainText(`Багш ${colleague.phone}`);
  await logout(page);

  // 5. Шилжүүлж авсан багш хүсэлтийг харж, төлөв шинэчилнэ. Дахин шилжүүлэх товч байхгүй.
  await login(page, colleague.phone, colleague.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto("/teacher/placement-requests");
  await expect(page.getByTestId("forwarded-to-me")).toBeVisible();
  const mine = page.getByTestId("placement-request").filter({ hasText: studentName });
  await expect(mine).toBeVisible();
  await expect(mine.getByTestId("forward-open")).toHaveCount(0);
  await mine.getByLabel("Төлөв").selectOption({ label: "Холбогдсон" });
  await mine.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByTestId("placement-request").filter({ hasText: studentName }).getByLabel("Төлөв")).toHaveValue("CONTACTED");
  await logout(page);
});
