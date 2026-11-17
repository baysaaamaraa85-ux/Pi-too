import { expect, test } from "@playwright/test";
import { backdateEnrollment, bearer, createTeacherWithClasses, enrollViaApi, insertLesson, weekdaysExceptToday } from "./api-helpers";
import { login, uniquePhone } from "./helpers";

test.use({ viewport: { width: 360, height: 740 } });

// ФБШ-15, ADR-007: сүлжээгүй үед ирц төхөөрөмжид хадгалагдаж, холболт сэргэхэд автоматаар
// ЯГ НЭГ удаа сервер рүү орно (өгөгдөл 0 алдагдалтай, давхар хасалтгүй).
test("ФБШ-15: сүлжээг салгаж ирц хадгалаад, холбоход автоматаар илгээгдэж нэг л удаа хасагдана", async ({
  page,
  context,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  const lessonId = await insertLesson(teacher.classIds[0]!, teacher.teacherId, 10);
  const contractIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const res = await enrollViaApi(request, teacher.token, teacher.classIds, {
      studentName: `Офлайн сурагч ${uniquePhone()}`,
    });
    expect(res.status()).toBe(201);
    const contractId = ((await res.json()) as { contractId: string }).contractId;
    await backdateEnrollment(contractId);
    contractIds.push(contractId);
  }

  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto(`/teacher/attendance/${lessonId}`);
  await expect(page.getByTestId("attendance-row")).toHaveCount(2);

  // 1. Сүлжээ тасарна, багш хадгална.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByTestId("queued-notice")).toBeVisible();
  await expect(page.getByTestId("offline-status")).toContainText("Сүлжээгүй байна, холбогдмогц илгээнэ");
  await expect(page.getByRole("button", { name: "Хадгалах" })).toBeDisabled();

  // Сервер дээр одоогоор бичигдээгүй.
  const sheetBefore = await request.get(`/api/v1/lessons/${lessonId}/attendance`, { headers: bearer(teacher.token) });
  const rowsBefore = ((await sheetBefore.json()) as { rows: { attendanceId: string | null }[] }).rows;
  expect(rowsBefore.every((r) => r.attendanceId === null)).toBe(true);

  // 2. Холболт сэргэнэ: автоматаар илгээгдэж, туузан мэдэгдэл алга болно.
  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId("row-status").first()).toContainText("Ирсэн");

  // 3. Сервер дээр сурагч бүрт яг нэг ирц, багц нэг л удаа хасагдсан.
  const sheetAfter = await request.get(`/api/v1/lessons/${lessonId}/attendance`, { headers: bearer(teacher.token) });
  const rows = ((await sheetAfter.json()) as {
    rows: { attendanceId: string | null; contractId: string; remainingHours: number; status: string }[];
  }).rows;
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.attendanceId).not.toBeNull();
    expect(row.status).toBe("PRESENT");
    expect(row.remainingHours).toBe(72);
  }
  expect(rows.map((r) => r.contractId).sort()).toEqual([...contractIds].sort());
});

// Сервер татгалзвал (жишээ нь хичээл олдохгүй) өгөгдөл алдагдахгүй, хэрэглэгчид харагдана.
test("ФБШ-15: сервер татгалзсан дараалалын ирц туузан мэдэгдэлд алдаатай гарч, хэрэглэгч хаана", async ({
  page,
  request,
}) => {
  const teacher = await createTeacherWithClasses(request, weekdaysExceptToday(2));
  await login(page, teacher.phone, teacher.password);
  await expect(page).toHaveURL(/\/teacher$/);

  await page.evaluate(async () => {
    const user = JSON.parse(localStorage.getItem("pitoo.lastUser") ?? "{}") as { id: string };
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("pitoo-offline", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("attendance", { keyPath: "lessonId" });
      open.onsuccess = () => {
        const tx = open.result.transaction("attendance", "readwrite");
        tx.objectStore("attendance").put({
          lessonId: crypto.randomUUID(),
          userId: user.id,
          key: crypto.randomUUID(),
          entries: [{ contractId: crypto.randomUUID(), present: true }],
          createdAt: new Date().toISOString(),
          status: "pending",
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
    window.dispatchEvent(new Event("online"));
  });
  // Дараалал өөрчлөгдсөнийг баннер мэдэхийн тулд хуудсыг дахин ачаална (дараалал IndexedDB-д хэвээр).
  await page.reload();

  const rejected = page.getByTestId("offline-rejected");
  await expect(rejected).toBeVisible({ timeout: 30_000 });
  await rejected.getByRole("button", { name: "Хаах" }).click();
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
});
