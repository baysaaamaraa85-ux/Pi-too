import { expect, test } from "@playwright/test";
import { apiAsAdmin, bearer, createTeacherWithClasses, weekdaysExceptToday } from "./api-helpers";
import { login, loginAsAdmin } from "./helpers";

// 1x1 PNG: сервер зөвхөн файлын эхний байтыг (magic bytes) шалгана.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

// ФШ-78: нийтийн сайт нэвтрэлтгүй, багш, хөтөлбөр, үнэ, салбар нь өгөгдлийн сангаас.

test("ФШ-78: нүүр хуудасны цэс, hero, давуу талын карт, тоон мэдээлэл өгөгдлийн сангаас", async ({ page, request }) => {
  const branches = (await (await request.get("/api/v1/public/branches")).json()) as { name: string }[];
  await page.goto("/");

  const nav = page.getByRole("navigation").first();
  // Цэс: анхны загвар (3 холбоос) ба "Манай төв" цувирдаг цэс ("Бидний тухай", "Салбарууд").
  for (const label of ["Нүүр", "Хөтөлбөр", "Багш нар", "Нэвтрэх", "Бүртгүүлэх", "Бидэнтэй шууд холбогдох"]) {
    await expect(nav.getByRole("link", { name: label }).first()).toBeVisible();
  }
  await expect(nav.getByRole("button", { name: /Манай төв/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("тусгайлан");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("математик");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("сургалт");

  // Каруселийн багцын карт (D-84): тоонууд settings-ээс (6 суудал, 75 цаг, 3 чөлөө, 93%).
  const card = page.getByRole("group", { name: /цагийн багц хөтөлбөр/ });
  await expect(card).toContainText("75 цагийн багц хөтөлбөр");
  await expect(card).toContainText("2–6 сурагч");
  await expect(card).toContainText("3 удаа чөлөө");
  await expect(card).toContainText("93 хувиас");
  // Карусель: эхний карт "Нэг багш 2–6 сурагч", гурав дахь карт хөтөлбөрийн төрлүүдийг нэрлэнэ.
  await expect(page.getByRole("group", { name: "Хөтөлбөрүүд" })).toContainText("бүх төрлийн хөтөлбөр");
  await expect(page.getByRole("group", { name: "Пи тоо сургалт" })).toContainText("Нэг багш 2–6 сурагч");

  // Нүүр хуудас товч: "Бидний тухай", "Салбарууд" нь нүүрэнд биш цэсэнд, нүүрэнд үнэ, салбарын жагсаалт байхгүй.
  await expect(page.getByTestId("home-explore")).toHaveCount(0);
  await expect(page.getByTestId("public-prices")).toHaveCount(0);
  await expect(page.getByTestId("public-branches")).toHaveCount(0);

  // "Салбарууд" холбоос тусдаа хуудас руу аваачна, бүх салбар нэр, хаягтай.
  await nav.getByRole("button", { name: /Манай төв/ }).click();
  await nav.getByRole("link", { name: /Салбарууд/ }).click();
  await expect(page).toHaveURL(/\/branches$/);
  await expect(page.getByTestId("public-branches").getByRole("listitem").filter({ has: page.getByRole("heading") })).toHaveCount(branches.length);
  await expect(page.getByTestId("public-branches")).toContainText(branches[0]!.name);
});

test("ФШ-78: Бидний тухай хуудас: түүх, багш, салбарын тоо DB-ээс, байгууллагын зурагтай", async ({ page, request }) => {
  const teachers = (await (await request.get("/api/v1/public/teachers")).json()) as unknown[];
  const branches = (await (await request.get("/api/v1/public/branches")).json()) as unknown[];
  await page.goto("/");
  const nav = page.getByRole("navigation").first();
  await nav.getByRole("button", { name: /Манай төв/ }).click();
  await nav.getByRole("link", { name: /Бидний тухай/ }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("about-origin")).toContainText("Пи тоо");
  await expect(page.getByTestId("about-today")).toContainText(`${teachers.length} багш`);
  await expect(page.getByTestId("about-today")).toContainText(`${branches.length} салбарт`);
  await expect(page.getByTestId("about-stats")).toContainText("Салбар");
  await expect(page.getByRole("img", { name: /сурагчид багштайгаа/ })).toBeVisible();
});

test("ФШ-78: салбарын зураг, тайлбар, утас нийтийн Салбарууд хуудсанд; утасгүй бол төвийн ерөнхий утас", async ({ page, request }) => {
  const admin = await apiAsAdmin(request);
  const name = `ЯЯ салбар ${Date.now()}`;
  const created = await request.post("/api/v1/branches", {
    headers: bearer(admin.token),
    data: { name, address: "Сүхбаатар дүүрэг, 1-р хороо", description: "Төв шуудангийн ард, 2 давхар", phones: ["99112233", "88112233"] },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const put = await request.put(`/api/v1/branches/${id}/photo`, {
    headers: { ...bearer(admin.token), "Content-Type": "image/png" },
    data: PNG,
  });
  expect(put.status()).toBe(200);
  const { photoUrl } = (await put.json()) as { photoUrl: string };
  const bare = await request.post("/api/v1/branches", {
    headers: bearer(admin.token),
    data: { name: `${name} утасгүй`, address: "Хан-Уул дүүрэг" },
  });
  expect(bare.status()).toBe(201);

  await page.goto("/branches");
  const card = page.getByTestId("public-branch").filter({ hasText: name }).first();
  await expect(card).toContainText("Сүхбаатар дүүрэг, 1-р хороо");
  await expect(card).toContainText("Төв шуудангийн ард");
  await expect(card.getByRole("link", { name: "99112233" })).toHaveAttribute("href", "tel:99112233");
  await expect(card.getByRole("link", { name: "88112233" })).toBeVisible();
  await expect(card.getByRole("img", { name: `${name} салбар` })).toHaveAttribute("src", photoUrl);
  const fallback = page.getByTestId("public-branch").filter({ hasText: `${name} утасгүй` });
  await expect(fallback.getByRole("link", { name: "88118993" })).toBeVisible();
});

test("ФШ-78: админ салбарын тайлбар, утсыг самбараас засахад нийтийн хуудсанд шинэчлэгдэнэ", async ({ page, request }) => {
  const admin = await apiAsAdmin(request);
  const name = `ЯЯ засах ${Date.now()}`;
  const created = await request.post("/api/v1/branches", { headers: bearer(admin.token), data: { name, address: "Баянзүрх" } });
  expect(created.status()).toBe(201);

  await loginAsAdmin(page);
  await page.goto("/admin/catalog");
  const row = page.getByTestId("branch-row").filter({ hasText: name });
  await row.getByRole("button", { name: "Нийтийн сайтад харагдах" }).click();
  await row.getByLabel("Тайлбар").fill("Гэрлэн дохионы баруун талд");
  await row.getByLabel("Холбоо барих утас").fill("77001122, 77001133");
  await row.getByTestId("photo-input").setInputFiles({ name: "salbar.png", mimeType: "image/png", buffer: PNG });
  await expect(row.getByText("Зураг хадгалагдлаа.")).toBeVisible();
  await row.getByRole("button", { name: "Хадгалах" }).click();
  await expect(row.getByText("Хадгалагдлаа.", { exact: true })).toBeVisible();

  await page.goto("/branches");
  const card = page.getByTestId("public-branch").filter({ hasText: name }).first();
  await expect(card).toContainText("Гэрлэн дохионы баруун талд");
  await expect(card.getByRole("link", { name: "77001122" })).toBeVisible();
  await expect(card.getByRole("img", { name: `${name} салбар` })).toHaveAttribute("src", /^\/uploads\/branches\//);
});

test("ФШ-78: админы шинээр нэмсэн багш нийтийн Багш нар хуудас, нүүрэнд гарч, мэргэшлийг засахад шинэчлэгдэнэ", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const name = `Багш ${teacher.phone}`;

  // Нэвтрэлтгүй хүн шууд харна, утас харагдахгүй.
  await page.goto("/teachers");
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText(teacher.phone, { exact: false }).filter({ hasNotText: name })).toHaveCount(0);

  await loginAsAdmin(page);
  await page.goto(`/admin/teachers/${teacher.teacherId}`);
  await page.getByLabel("Мэргэшил").fill("ЭЕШ-e2e, Олимпиад-e2e");
  await page.getByLabel("Мэргэшил").press("Enter");
  await expect(page.getByText("Хадгалагдлаа.", { exact: true })).toBeVisible();
  await page.getByTestId("teacher-photo").getByTestId("photo-input").setInputFiles({ name: "bagsh.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Зураг хадгалагдлаа.")).toBeVisible();

  await page.goto("/teachers");
  const card = page.getByRole("listitem").filter({ hasText: name }).first();
  await expect(card).toContainText("ЭЕШ-e2e");
  await expect(card).toContainText("Олимпиад-e2e");
  await expect(card.getByRole("img", { name })).toHaveAttribute("src", /^\/uploads\/teachers\/.+\.png$/);

  // Нүүр хуудасны "Манай багш нар" хэсэгт мөн гарна.
  await page.goto("/");
  await expect(page.getByTestId("home-teachers")).toContainText(name);
});

test("ФШ-78, ФШ-08: хөтөлбөрийн хэсэгт ангиллын гарчиг дээр үнэ, цагийн багц; үнэ хөтөлбөрийн жинхэнэ үнэтэй нэг", async ({ page, request }) => {
  const programs = (await (await request.get("/api/v1/public/programs")).json()) as { name: string; price: string }[];
  const digits = (text: string) => text.replace(/\D/g, "");
  const expected = (name: string) => digits(String(Number(programs.find((p) => p.name === name)!.price)));

  await page.goto("/programs");
  // Эхний таб: Олон улсын хөтөлбөр.
  await expect(page.getByTestId("track-price")).toContainText("75 цагийн багц");
  expect(digits(await page.getByTestId("track-price").innerText())).toContain(expected("Олон улсын стандарт"));
  await page.getByRole("tab", { name: "Монгол хөтөлбөр" }).click();
  await expect(page.getByTestId("track-price")).toContainText("75 цагийн багц");
  expect(digits(await page.getByTestId("track-price").innerText())).toContain(expected("Монгол стандарт"));
  // Үнэгүй ангилал (сургуулийн шалгалт) үнэ харуулахгүй.
  await page.getByRole("tab", { name: "Сургуулийн шалгалт" }).click();
  await expect(page.getByTestId("track-price")).toHaveCount(0);

  // Нүүрний хөтөлбөрийн картууд хэрэглэгчийн үзүүлсэн анхны загвар ёсоор үнэгүй (D-74): үнэ "Хөтөлбөр", "Бүртгүүлэх" хуудсанд.
  await page.goto("/");
  await expect(page.getByTestId("track-price")).toHaveCount(0);
});

test("ФШ-78: багш өөрийн профайл хуудаснаас зураг оруулж, нийтийн сайт ба цэсэнд харагдана; өөр багшийнх 403", async ({ page, request }) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(1));
  const other = await createTeacherWithClasses(request, weekdaysExceptToday(1));

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByRole("link", { name: "Миний профайл" }).first().click();
  await expect(page).toHaveURL(/\/teacher\/profile$/);
  await page.getByTestId("photo-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Зураг хадгалагдлаа.")).toBeVisible();

  const name = `Багш ${teacher.phone}`;
  await page.goto("/teachers");
  await expect(page.getByRole("listitem").filter({ hasText: name }).first().getByRole("img", { name })).toHaveAttribute(
    "src",
    /^\/uploads\/teachers\/.+\.png$/,
  );

  // BOLA: өөр багшийн зургийг солих боломжгүй.
  const denied = await request.put(`/api/v1/teachers/${other.teacherId}/photo`, {
    headers: { ...bearer(teacher.token), "Content-Type": "image/png" },
    data: PNG,
  });
  expect(denied.status()).toBe(403);
});

test.describe("утсан дэлгэц", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  for (const path of ["/", "/teachers", "/programs", "/about", "/branches", "/contact"]) {
    test(`ФБШ-10: нийтийн ${path} хуудас 360 px-д хэвтээ гүйлгэлтгүй`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
