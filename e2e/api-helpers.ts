import { expect, type APIRequestContext } from "@playwright/test";
import pg from "pg";
import { E2E } from "./env.mjs";
import { uniquePhone } from "./helpers";

// API-аар тест бэлтгэх туслахууд (UI-аар давтахгүй).

export async function apiLogin(request: APIRequestContext, identifier: string, password: string) {
  const res = await request.post("/api/v1/auth/login", { data: { identifier, password } });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { accessToken: string; user: { id: string } };
  return { token: body.accessToken, userId: body.user.id };
}

export async function apiAsAdmin(request: APIRequestContext) {
  return apiLogin(request, E2E.adminPhone, E2E.adminPassword);
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface TeacherFixture {
  phone: string;
  password: string;
  token: string;
  teacherId: string;
  classIds: string[];
  branchId: string;
}

// Админ багш үүсгэнэ, багш түр нууц үгээ API-аар солино, цагийн үнэлгээ тогтооно,
// өгөгдсөн гаруудад (10:00) анги үүсгэнэ.
export async function createTeacherWithClasses(
  request: APIRequestContext,
  weekdays: number[],
): Promise<TeacherFixture> {
  const admin = await apiAsAdmin(request);
  const phone = uniquePhone();
  const created = await request.post("/api/v1/teachers", {
    headers: bearer(admin.token),
    data: { fullName: `Багш ${phone}`, phone },
  });
  expect(created.status()).toBe(201);
  const temp = (await created.json()) as { id: string; tempPassword: string };

  const first = await apiLogin(request, phone, temp.tempPassword);
  const password = "BagshE2e123!";
  const change = await request.post("/api/v1/auth/password/change", {
    headers: bearer(first.token),
    data: { currentPassword: temp.tempPassword, newPassword: password },
  });
  expect(change.status()).toBe(204);

  const branches = (await (
    await request.get("/api/v1/branches", { headers: bearer(admin.token) })
  ).json()) as { id: string }[];
  const branchId = branches[0]!.id;

  const teacher = await apiLogin(request, phone, password);
  const classIds: string[] = [];
  for (const weekday of weekdays) {
    const res = await request.post("/api/v1/classes", {
      headers: bearer(teacher.token),
      data: { branchId, weekday, startTime: "10:00" },
    });
    expect(res.status()).toBe(201);
    classIds.push(((await res.json()) as { id: string }).id);
  }
  return { phone, password, token: teacher.token, teacherId: temp.id, classIds, branchId };
}

export async function firstProgramId(request: APIRequestContext): Promise<string> {
  const admin = await apiAsAdmin(request);
  const programs = (await (
    await request.get("/api/v1/programs", { headers: bearer(admin.token) })
  ).json()) as { id: string }[];
  return programs[0]!.id;
}

// D-67, D-68: багш хүүхэд бүр дээрээ цагийн цалингаа гараар оруулна (хэзээ ч засна, бүх хичээлд үйлчилнэ).
export async function setRateViaApi(
  request: APIRequestContext,
  teacherToken: string,
  contractId: string,
  hourlyRate = "5000.00",
) {
  const res = await request.put(`/api/v1/contracts/${contractId}/rate`, {
    headers: bearer(teacherToken),
    data: { hourlyRate },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as { adjusted: number };
}

// Багшийн нэрийн өмнөөс сурагч бүртгэнэ (API). rate: false биш бол багш хүүхдэд 5 000 ₮-ийн үнэлгээ оруулна
// (өмнөх тестүүдийн 5 000 x 2 цаг = 10 000 ₮ тооцоо хэвээр байхын тулд).
export async function enrollViaApi(
  request: APIRequestContext,
  token: string,
  classIds: string[],
  extra: { studentName?: string; parentPhone?: string; studentPhone?: string; rate?: string | false } = {},
) {
  const now = new Date().toISOString();
  const res = await request.post("/api/v1/enrollments", {
    headers: bearer(token),
    data: {
      parentPhone: extra.parentPhone ?? uniquePhone(),
      parentFullName: "Эцэг",
      studentFullName: extra.studentName ?? `Сурагч ${uniquePhone()}`,
      studentPhone: extra.studentPhone,
      programId: await firstProgramId(request),
      classIds,
      fromDate: now.slice(0, 10),
      rulesAcknowledged: true,
      consentGiven: true,
    },
  });
  if (res.status() === 201 && extra.rate !== false) {
    const { contractId } = (await res.json()) as { contractId: string };
    await setRateViaApi(request, token, contractId, extra.rate ?? "5000.00");
  }
  return res;
}

// ---- Ирцийн e2e: хичээлийг SQL-ээр шууд үүсгэнэ (цаг хугацааг удирдахын тулд) ----


// Улаанбаатарын өнөөдрийн гараг (1=Даваа...7=Ням).
export function todayWeekday(): number {
  const local = new Date(Date.now() + 8 * 3_600_000);
  const js = local.getUTCDay();
  return js === 0 ? 7 : js;
}

// Өнөөдрөөс өөр гаруудыг сонгоно: ангийн ердийн хичээл (4 долоо хоног) туршилтын
// хичээлтэй цагаар давхцахгүй.
export function weekdaysExceptToday(count: number): number[] {
  const today = todayWeekday();
  const result: number[] = [];
  for (let d = 1; d <= 7 && result.length < count; d++) if (d !== today) result.push(d);
  return result;
}

// Хичээл startOffsetMin минутын өмнө эхэлж (сөрөг бол ирээдүйд) durationMin үргэлжилнэ.
export async function insertLesson(
  classId: string,
  teacherId: string,
  startOffsetMin: number,
  durationMin = 120,
): Promise<string> {
  const client = new pg.Client({ connectionString: E2E.databaseUrl });
  await client.connect();
  try {
    const startsAt = new Date(Date.now() - startOffsetMin * 60_000);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    const res = await client.query(
      `INSERT INTO lessons (id, class_id, teacher_id, starts_at, ends_at, original_starts_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $3, now()) RETURNING id`,
      [classId, teacherId, startsAt, endsAt],
    );
    return res.rows[0].id as string;
  } finally {
    await client.end();
  }
}

export async function insertLeaveRequest(contractId: string, lessonId: string, userId: string) {
  const client = new pg.Client({ connectionString: E2E.databaseUrl });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO leave_requests (id, contract_id, lesson_id, requested_by)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [contractId, lessonId, userId],
    );
  } finally {
    await client.end();
  }
}

// Өмнөх өдрүүдийн хичээлийн жагсаалтад орохын тулд бүртгэлийн эхлэх огноог урагшлуулна.
export async function backdateEnrollment(contractId: string) {
  const client = new pg.Client({ connectionString: E2E.databaseUrl });
  await client.connect();
  try {
    await client.query("UPDATE enrollments SET from_date = '2026-01-01' WHERE contract_id = $1", [
      contractId,
    ]);
  } finally {
    await client.end();
  }
}
