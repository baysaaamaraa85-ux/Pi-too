import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";
import { createPlacementRequest } from "./placement.service.js";

const app = createApp();

async function tokenFor(role: Role) {
  const phone = `pr${randomUUID().replace(/-/g, "").slice(0, 9)}`;
  await prisma.user.create({
    data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return res.body.accessToken as string;
}

describe("Нийтийн сайтын түвшин тогтоох цагийн хүсэлт", () => {
  it("нэвтрэлтгүйгээр хүсэлт илгээж болно, утасны хоосон зай хасагдана", async () => {
    const res = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Тест сурагч", phone: "9911 1234", grade: "9-р анги" });
    expect(res.status).toBe(201);

    const saved = await prisma.placementRequest.findUnique({ where: { id: res.body.id } });
    expect(saved?.phone).toBe("99111234");
    expect(saved?.status).toBe("NEW");
  });

  it("буруу утасны дугаарт 422", async () => {
    const res = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Тест", phone: "123" });
    expect(res.status).toBe(422);
  });

  it("байхгүй салбар заавал 404", async () => {
    const res = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Тест", phone: "99112233", branchId: randomUUID() });
    expect(res.status).toBe(404);
  });

  it("жагсаалтыг зөвхөн админ харна, багш 403, нэвтрээгүй 401", async () => {
    const anonymous = await request(app).get("/api/v1/placement-requests");
    expect(anonymous.status).toBe(401);

    const teacher = await request(app)
      .get("/api/v1/placement-requests")
      .set("Authorization", `Bearer ${await tokenFor(Role.TEACHER)}`);
    expect(teacher.status).toBe(403);

    const admin = await request(app)
      .get("/api/v1/placement-requests")
      .set("Authorization", `Bearer ${await tokenFor(Role.ADMIN)}`);
    expect(admin.status).toBe(200);
    expect(Array.isArray(admin.body)).toBe(true);
  });

  it("админ хүсэлтийн төлөв шинэчилнэ", async () => {
    const created = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Төлөв тест", phone: "99112244" });
    const res = await request(app)
      .patch(`/api/v1/placement-requests/${created.body.id}`)
      .set("Authorization", `Bearer ${await tokenFor(Role.ADMIN)}`)
      .send({ status: "SCHEDULED", note: "Баасан 17:00" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SCHEDULED");
  });
});

describe("Нийтийн салбарын жагсаалт", () => {
  // ФШ-78 (D-65, D-66): нийтийн сайт салбарын нэр, хаяг, тайлбар, утас, зургийг харуулна. Бусад талбар (үүсгэсэн огноо гэх мэт) гарахгүй.
  it("нэвтрэлтгүй зөвхөн нийтийн талбаруудыг буцаана", async () => {
    const res = await request(app).get("/api/v1/public/branches");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual(["address", "description", "id", "name", "phones", "photoUrl"]);
  });
});

// ---------------------------------------------------------------------------
// D-102: салбарын ахлагч, түвшин тогтоох хүсэлтийн хуваарилалт, шилжүүлэлт
// ---------------------------------------------------------------------------

async function makeTeacher(opts: { branchId?: string; active?: boolean } = {}) {
  const phone = `ld${randomUUID().replace(/-/g, "").slice(0, 9)}`;
  const user = await prisma.user.create({
    data: {
      role: Role.TEACHER,
      phone,
      passwordHash: await bcrypt.hash("Correct123!", 10),
      isActive: opts.active ?? true,
    },
  });
  await prisma.teacher.create({ data: { userId: user.id, fullName: `Багш ${phone}` } });
  if (opts.branchId) {
    await prisma.class.create({
      data: { teacherId: user.id, branchId: opts.branchId, weekday: 2, startTime: "10:00", durationMin: 120, capacity: 6 },
    });
  }
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { id: user.id, token: res.body.accessToken as string | undefined };
}

const newBranch = () =>
  prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } });

const auth = (token: string | undefined) => ({ Authorization: `Bearer ${token}` });

const setLead = (adminToken: string, branchId: string, teacherId: string | null) =>
  request(app).put(`/api/v1/branches/${branchId}/lead`).set(auth(adminToken)).send({ teacherId });

// Нийтийн endpoint нэг IP-аас 10 минутад 5 хүсэлтээр хязгаарлагддаг (спамаас хамгаалах) тул олон хүсэлт үүсгэхдээ
// service-ийг шууд дуудна. Жинхэнэ HTTP замыг доорх нэг тест шалгана.
const submitRequest = async (branchId?: string) => ({
  status: 201,
  body: await createPlacementRequest({ studentName: "Ахлагчийн тест", phone: "99115566", branchId }),
});

const outboxCount = (recipientId: string, template: string) =>
  prisma.notificationOutbox.count({ where: { recipientId, template } });

describe("D-102 Салбарын ахлагч", () => {
  it("админ салбарын ахлагчийг томилно, зөвхөн тухайн салбарт анги заадаг идэвхтэй багшийг", async () => {
    const branch = await newBranch();
    const otherBranch = await newBranch();
    const teacher = await makeTeacher({ branchId: branch.id });
    const outsider = await makeTeacher({ branchId: otherBranch.id });
    const inactive = await makeTeacher({ branchId: branch.id, active: false });
    const adminToken = await tokenFor(Role.ADMIN);

    expect((await setLead(adminToken, branch.id, teacher.id)).status).toBe(200);
    const saved = await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } });
    expect(saved.leadTeacherId).toBe(teacher.id);
    expect(await outboxCount(teacher.id, "branch_lead_assigned")).toBe(1);

    // Өөр салбарын багш, идэвхгүй багш, байхгүй багш.
    expect((await setLead(adminToken, branch.id, outsider.id)).body.type).toContain("lead-not-in-branch");
    expect((await setLead(adminToken, branch.id, inactive.id)).body.type).toContain("lead-inactive");
    expect((await setLead(adminToken, branch.id, randomUUID())).status).toBe(404);
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).leadTeacherId).toBe(teacher.id);

    // Хасах.
    expect((await setLead(adminToken, branch.id, null)).status).toBe(200);
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).leadTeacherId).toBeNull();
  });

  it("ахлагч томилох эрх зөвхөн админд: багш 403, нэвтрээгүй 401", async () => {
    const branch = await newBranch();
    const teacher = await makeTeacher({ branchId: branch.id });
    expect((await setLead(teacher.token!, branch.id, teacher.id)).status).toBe(403);
    const anon = await request(app).put(`/api/v1/branches/${branch.id}/lead`).send({ teacherId: teacher.id });
    expect(anon.status).toBe(401);
  });

  it("салбарын жагсаалтад ахлагч харагдана", async () => {
    const branch = await newBranch();
    const teacher = await makeTeacher({ branchId: branch.id });
    const adminToken = await tokenFor(Role.ADMIN);
    await setLead(adminToken, branch.id, teacher.id);
    const res = await request(app).get("/api/v1/branches").set(auth(adminToken));
    const row = (res.body as { id: string; leadTeacher: { id: string } | null }[]).find((b) => b.id === branch.id);
    expect(row?.leadTeacher?.id).toBe(teacher.id);
  });

  it("шинэ хүсэлт салбарын ахлагчид хуваарилагдаж мэдэгдэл очно; ахлагчгүй, салбаргүй, идэвхгүй ахлагчтай бол хуваарилагдахгүй", async () => {
    const branch = await newBranch();
    const noLeadBranch = await newBranch();
    const lead = await makeTeacher({ branchId: branch.id });
    const adminToken = await tokenFor(Role.ADMIN);
    await setLead(adminToken, branch.id, lead.id);

    const created = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Ахлагчийн тест", phone: "99115566", branchId: branch.id });
    expect(created.status).toBe(201);
    const saved = await prisma.placementRequest.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(saved.assignedTeacherId).toBe(lead.id);
    expect(await outboxCount(lead.id, "placement_request_new")).toBe(1);

    const noLead = await submitRequest(noLeadBranch.id);
    expect((await prisma.placementRequest.findUniqueOrThrow({ where: { id: noLead.body.id } })).assignedTeacherId).toBeNull();
    const noBranch = await submitRequest();
    expect((await prisma.placementRequest.findUniqueOrThrow({ where: { id: noBranch.body.id } })).assignedTeacherId).toBeNull();

    // Ахлагч нь дараа нь идэвхгүй болбол шинэ хүсэлт түүнд очихгүй.
    await prisma.user.update({ where: { id: lead.id }, data: { isActive: false } });
    const afterInactive = await submitRequest(branch.id);
    expect(
      (await prisma.placementRequest.findUniqueOrThrow({ where: { id: afterInactive.body.id } })).assignedTeacherId,
    ).toBeNull();
    expect(await outboxCount(lead.id, "placement_request_new")).toBe(1);
  });

  it("BOLA: багш зөвхөн өөрийн ахалдаг салбарын хүсэлтийг харж засна, өөр салбарын, ахлагч биш багш үгүй", async () => {
    const branchA = await newBranch();
    const branchB = await newBranch();
    const leadA = await makeTeacher({ branchId: branchA.id });
    const leadB = await makeTeacher({ branchId: branchB.id });
    const plain = await makeTeacher({ branchId: branchA.id });
    const adminToken = await tokenFor(Role.ADMIN);
    await setLead(adminToken, branchA.id, leadA.id);
    await setLead(adminToken, branchB.id, leadB.id);
    const requestA = (await submitRequest(branchA.id)).body.id as string;

    const mineA = await request(app).get("/api/v1/teacher/placement-requests").set(auth(leadA.token));
    expect(mineA.status).toBe(200);
    expect(mineA.body.isLead).toBe(true);
    expect((mineA.body.requests as { id: string }[]).map((r) => r.id)).toContain(requestA);

    const mineB = await request(app).get("/api/v1/teacher/placement-requests").set(auth(leadB.token));
    expect((mineB.body.requests as { id: string }[]).map((r) => r.id)).not.toContain(requestA);

    const mineP = await request(app).get("/api/v1/teacher/placement-requests").set(auth(plain.token));
    expect(mineP.body).toMatchObject({ isLead: false, requests: [] });

    const patch = (token: string | undefined) =>
      request(app).patch(`/api/v1/placement-requests/${requestA}`).set(auth(token)).send({ status: "CONTACTED", note: "Залгасан" });
    expect((await patch(leadB.token)).status).toBe(403);
    expect((await patch(plain.token)).status).toBe(403);
    const ok = await patch(leadA.token);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: "CONTACTED", note: "Залгасан" });
    expect((await patch(adminToken)).status).toBe(200);

    // Админы жагсаалтыг багш харахгүй, хүсэлтэд хариуцагч харагдана.
    expect((await request(app).get("/api/v1/placement-requests").set(auth(leadA.token))).status).toBe(403);
    const adminList = await request(app).get("/api/v1/placement-requests").set(auth(adminToken));
    const row = (adminList.body as { id: string; assignedTeacher: { id: string } | null }[]).find((r) => r.id === requestA);
    expect(row?.assignedTeacher?.id).toBe(leadA.id);
  });

  it("ахлагч хүсэлтийг салбарын өөр багшид шилжүүлнэ: тэр багш мэдэгдэл авч, хүсэлтийг харж засна, дахин шилжүүлж чадахгүй", async () => {
    const branch = await newBranch();
    const lead = await makeTeacher({ branchId: branch.id });
    const colleague = await makeTeacher({ branchId: branch.id });
    const adminToken = await tokenFor(Role.ADMIN);
    await setLead(adminToken, branch.id, lead.id);
    const id = (await submitRequest(branch.id)).body.id as string;

    const candidates = await request(app).get(`/api/v1/placement-requests/${id}/forward-candidates`).set(auth(lead.token));
    expect(candidates.status).toBe(200);
    // Одоогийн хариуцагч (ахлагч өөрөө) жагсаалтад байхгүй, хамт олон байна.
    expect((candidates.body as { id: string }[]).map((c) => c.id)).toEqual([colleague.id]);

    const forward = await request(app)
      .post(`/api/v1/placement-requests/${id}/forward`)
      .set(auth(lead.token))
      .send({ teacherId: colleague.id });
    expect(forward.status).toBe(200);
    expect(forward.body.assignedTeacher.id).toBe(colleague.id);
    expect(await outboxCount(colleague.id, "placement_request_forwarded")).toBe(1);

    // Шилжүүлж авсан багш хүсэлтээ харж, төлөв шинэчилнэ.
    const mine = await request(app).get("/api/v1/teacher/placement-requests").set(auth(colleague.token));
    expect(mine.body.isLead).toBe(false);
    expect((mine.body.requests as { id: string }[]).map((r) => r.id)).toEqual([id]);
    const update = await request(app)
      .patch(`/api/v1/placement-requests/${id}`)
      .set(auth(colleague.token))
      .send({ status: "SCHEDULED", note: "Баасан 17:00" });
    expect(update.status).toBe(200);

    // Ахлагч мөн л хүсэлтээ харсаар, харин шилжүүлж авсан багш дахин шилжүүлж чадахгүй.
    const leadView = await request(app).get("/api/v1/teacher/placement-requests").set(auth(lead.token));
    expect((leadView.body.requests as { id: string }[]).map((r) => r.id)).toContain(id);
    const again = await request(app)
      .post(`/api/v1/placement-requests/${id}/forward`)
      .set(auth(colleague.token))
      .send({ teacherId: lead.id });
    expect(again.status).toBe(403);

    const audit = await prisma.auditLog.findFirst({ where: { entity: "placement_request", entityId: id, action: "FORWARD" } });
    expect(audit?.after).toMatchObject({ assignedTeacherId: colleague.id });
  });

  it("шилжүүлэх хязгаар: өөр салбарын багш 409, хаагдсан хүсэлт 409, ахлагч биш багш 403, админ 403", async () => {
    const branch = await newBranch();
    const otherBranch = await newBranch();
    const lead = await makeTeacher({ branchId: branch.id });
    const colleague = await makeTeacher({ branchId: branch.id });
    const outsider = await makeTeacher({ branchId: otherBranch.id });
    const adminToken = await tokenFor(Role.ADMIN);
    await setLead(adminToken, branch.id, lead.id);
    const id = (await submitRequest(branch.id)).body.id as string;
    const forward = (token: string | undefined, teacherId: string) =>
      request(app).post(`/api/v1/placement-requests/${id}/forward`).set(auth(token)).send({ teacherId });

    const toOutsider = await forward(lead.token, outsider.id);
    expect(toOutsider.status).toBe(409);
    expect(toOutsider.body.type).toContain("forward-target-invalid");
    // Өөртөө (одоогийн хариуцагч) шилжүүлэх нь утгагүй.
    expect((await forward(lead.token, lead.id)).status).toBe(409);
    expect((await forward(colleague.token, lead.id)).status).toBe(403);
    expect((await forward(adminToken, colleague.id)).status).toBe(403);

    await prisma.placementRequest.update({ where: { id }, data: { status: "DONE" } });
    const closed = await forward(lead.token, colleague.id);
    expect(closed.status).toBe(409);
    expect(closed.body.type).toContain("placement-request-closed");
    expect((await prisma.placementRequest.findUniqueOrThrow({ where: { id } })).assignedTeacherId).toBe(lead.id);
  });

  it("ахлагч солигдоход нээлттэй хүсэлтүүд шинэ ахлагчид шилжинэ, бусад багшид шилжүүлсэн ба хаагдсан хүсэлт хөндөгдөхгүй", async () => {
    const branch = await newBranch();
    const oldLead = await makeTeacher({ branchId: branch.id });
    const newLead = await makeTeacher({ branchId: branch.id });
    const colleague = await makeTeacher({ branchId: branch.id });
    const adminToken = await tokenFor(Role.ADMIN);

    // Ахлагч томилохоос өмнө ирсэн хүсэлт (хуваарилагдаагүй).
    const early = (await submitRequest(branch.id)).body.id as string;
    await setLead(adminToken, branch.id, oldLead.id);
    expect((await prisma.placementRequest.findUniqueOrThrow({ where: { id: early } })).assignedTeacherId).toBe(oldLead.id);

    const open = (await submitRequest(branch.id)).body.id as string;
    const forwarded = (await submitRequest(branch.id)).body.id as string;
    const done = (await submitRequest(branch.id)).body.id as string;
    await request(app)
      .post(`/api/v1/placement-requests/${forwarded}/forward`)
      .set(auth(oldLead.token))
      .send({ teacherId: colleague.id });
    await prisma.placementRequest.update({ where: { id: done }, data: { status: "DONE" } });

    const res = await setLead(adminToken, branch.id, newLead.id);
    expect(res.status).toBe(200);
    const assignee = async (id: string) =>
      (await prisma.placementRequest.findUniqueOrThrow({ where: { id } })).assignedTeacherId;
    expect(await assignee(early)).toBe(newLead.id);
    expect(await assignee(open)).toBe(newLead.id);
    expect(await assignee(forwarded)).toBe(colleague.id);
    expect(await assignee(done)).toBe(oldLead.id);

    // Хуучин ахлагч өөрийн хуучин хүсэлтийг (хаагдсанаас бусад) харахаа больно.
    const oldView = await request(app).get("/api/v1/teacher/placement-requests").set(auth(oldLead.token));
    expect(oldView.body.isLead).toBe(false);
    expect((oldView.body.requests as { id: string }[]).map((r) => r.id)).toEqual([done]);

    // Ахлагчийг хасахад хуваарилагдсан нээлттэй хүсэлтүүд хуваарилагдаагүй болно.
    await setLead(adminToken, branch.id, null);
    expect(await assignee(open)).toBeNull();
    expect(await assignee(forwarded)).toBe(colleague.id);
  });

  it("ахлагч багшийг устгахад салбар ахлагчгүй болж, хүсэлтүүд хуваарилагдаагүй үлдэнэ", async () => {
    const branch = await newBranch();
    const lead = await makeTeacher();
    // Устгах боломжтой байхын тулд ангигүй багш: ахлагчаар шууд бичиж (админы шалгалтыг тойрч) туршина.
    await prisma.branch.update({ where: { id: branch.id }, data: { leadTeacherId: lead.id } });
    const req = await prisma.placementRequest.create({
      data: { studentName: "Устгах тест", phone: "99117788", branchId: branch.id, assignedTeacherId: lead.id },
    });

    const adminToken = await tokenFor(Role.ADMIN);
    const del = await request(app).delete(`/api/v1/teachers/${lead.id}`).set(auth(adminToken));
    expect(del.status).toBe(204);
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).leadTeacherId).toBeNull();
    expect((await prisma.placementRequest.findUniqueOrThrow({ where: { id: req.id } })).assignedTeacherId).toBeNull();
  });
});
