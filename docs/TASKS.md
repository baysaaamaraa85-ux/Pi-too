# Хэрэгжүүлэх ажлын дараалал

Энэ файл бол М1-М5-ыг 2026.11.02-ны явцын хяналт хүртэл ажиллагаатай болгох алхам алхмаар төлөвлөгөө. Дүрмүүд `CLAUDE.md`-д, бизнесийн дүрэм `docs/01-requirements.md` ба `docs/02-system-design.md`-д байна.

**Ажиллах арга:**

- Үе шатуудыг дарааллаар нь хий.
- Нэг үе шат дуусахад "Дууссаны шалгуур"-ыг өөрөө шалгаад, **ШАЛГАХ ЦЭГ** дээр зогсож хэрэглэгчид дүгнэлт өг.
- Хийсэн ажлын дэргэд `[x]` тэмдэглэ.
- Модуль эхлэхийн өмнө тухайн шаардлага, зохиомжийн хэсгийг унш (`CLAUDE.md` 3-р хэсгийн хүснэгт).

## Одоогийн байдал (2026.10.21)

Хэрэглэгч дараах зүйлсийг аль хэдийн хийсэн:

- `apps/api`, `apps/web`, `packages/contracts` хавтсууд үүссэн. `web` ба `contracts` хоосон.
- `apps/api/package.json` нь `"type": "module"`, `"name": "@pitoo/api"` болсон. Суусан багцууд: express, zod, dotenv, `@prisma/client@7.10.1`, `prisma@7.10.1` (devDependencies), typescript, tsx, vitest, supertest, @types/*.
- `apps/api` дотор тусдаа `node_modules` ба `package-lock.json` үүссэн.
- Үндсэн хавтаст `package.json` ба `docker-compose.yml` үүсгэсэн. Агуулгыг нь шалгах хэрэгтэй.
- Docker Desktop суусан, Engine running төлөвтэй.
- git init хийсэн эсэх нь тодорхойгүй.

---

## Үе шат 0. Одоогийн байдлыг шалгах

- [x] `node -v` 24.13.1, `npm -v` 11.12.1, `docker -v` 29.4.3, `git -v` 2.54.0.
- [x] Үндсэн `package.json` хоосон, `docker-compose.yml`-ийн агуулга буруу (жинхэнэ compose биш) байсан тул дахин бичсэн.
- [x] `apps/api/package.json`-д `"type"` нэг л удаа байсан.
- [x] git репо байхгүй байсан тул `git init` (PI.too.system-ийн үндэс дээр) ажиллуулсан.

**ШАЛГАХ ЦЭГ 0: дууссан.** `CLAUDE.md`, `TASKS.md`, `docs/01-requirements.md`, `docs/02-system-design.md`-ийг `PI.too.system/` дотор хуулсан (зорилтот бүтцийн дагуу CLAUDE.md репогийн үндэст байх ёстой байсан).

---

## Үе шат 1. Monorepo суурь

Зорилго: гурван багцыг нэг `npm install`-ээр удирдаж, хооронд нь импортлох боломжтой болгох.

- [x] Үндсэн `package.json`: `"name": "pi-too"`, `"private": true`, `"workspaces": ["apps/*", "packages/*"]`, scripts (`dev:api`, `dev:web`, `test`, `build`, `db:up/down/migrate/generate/studio/seed`).
- [x] `tsconfig.base.json`: `strict`, `target ES2023`, `module/moduleResolution NodeNext`, `skipLibCheck`.
- [x] `.gitignore`: `node_modules`, `.env*` (`.env.example` эс тооцвол), `dist`, `**/src/generated`, `coverage`, бас `.agents/.claude/.windsurf/skills-lock.json` (Prisma-ийн суулгасан AI-skill баримт, кодтой холбоогүй).
- [x] `.editorconfig`, `.prettierrc` (2 зай, давхар хашилт, `printWidth` 100).
- [x] `packages/contracts`: `package.json`, `tsconfig.json`, хоосон `src/index.ts`.
- [x] **Workspace руу шилжих:** `apps/api/node_modules`, `package-lock.json` устгасан, root-оос `npm install` (344 багц, 0 vulnerability), Prisma 7.10.1 хэвээр (`npm ls` баталгаажсан).
- [x] `apps/api`-д `@pitoo/contracts": "*"` нэмсэн.

**Дууссаны шалгуур: биелсэн.** `npm install` 0 алдаатай. `tsc --noEmit` нь `@pitoo/contracts`-ийг алдаагүй импортлосон.

**ШАЛГАХ ЦЭГ 1: дууссан, commit хийгдсэн** (`chore: monorepo суурь`).

---

## Үе шат 2. Өгөгдлийн сан

- [x] `docker-compose.yml`-д `db` сервис: `postgres:16`, `container_name: pitoo-db`, `postgres`/`dev`, DB `pitoo`, `pgdata` volume, `restart: unless-stopped`, healthcheck.
- [x] Тестийн DB: сонголт (а) — ижил контейнерт `docker/postgres/init.sql`-ээр `pitoo_test` үүсгэнэ.
- [x] `docker compose up -d`, `pitoo-db` Up (healthy).

**Чухал зөрүү:** Энэ компьютер дээр Docker-той хамааралгүй **native `postgres.exe`** (2026.10.15-наас хойш ажилласан, өөр зориулалттай) хост 5432 портыг аль хэдийн эзэмшиж байсан тул Docker-ын 5432→5432 холболт буруу (нэгдүгээрт эхэлсэн) серверт очиж, нэвтрэлт амжилтгүй болдог байсан. Тэр процессыг хөндөлгүй, зөвхөн **host порт 5440 болгож** (`5440:5432`) зөрчлөөс зайлсхийсэн; контейнер дотор 5432 хэвээр. `.env`, `.env.example`, `.env.test`-ийн `DATABASE_URL`/`TEST_DATABASE_URL`-г 5440 болгож шинэчилсэн.

**Дууссаны шалгуур: биелсэн.** `docker exec pitoo-db psql -U postgres -c "\l"` → `pitoo`, `pitoo_test` хоёул харагдсан.

---

## Үе шат 3. API-ийн араг яс

- [x] `apps/api/tsconfig.json` base-ийг extends, `rootDir: src`, `outDir: dist`, `types: ["node"]`.
- [x] scripts: `dev`, `worker`, `build`, `test` (`vitest run`), `test:watch`, `db:*`.
- [x] `src/config/env.ts`: `NODE_ENV`, `PORT`, `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_ORIGIN`, `ADMIN_PHONE`, `ADMIN_TEMP_PASSWORD`-ыг Zod-оор шалгана, дутуу бол Монгол алдаа хэвлээд `process.exit(1)`.
- [x] `.env.example`, `.env`, `.env.test` (тест DB-д зориулж).
- [x] `src/shared/errors/domain-error.ts`, `problem-details.ts`: `DomainError`, `notFoundHandler`, `problemDetails` (DomainError→өөрийн status, ZodError→422, бусад→500, лог руу бичнэ, хэрэглэгчид нуугдана).
- [x] `src/shared/logger.ts` (pino, нууц мэдээлэл redact), `src/shared/request-logger.ts` (pino-http, `x-request-id`).
- [x] `src/app.ts`, `src/api-v1.router.ts` (хоосон, модуль бүрийг дараа холбоно), `src/server.ts` (`dotenv/config`-г хамгийн түрүүнд импортлосон нь чухал — эс бөгөөс env.ts dotenv-ээс өмнө ачаалагдана).
- [x] `GET /health`: Prisma-гаар `SELECT 1`, амжилттай бол `{status:"ok",db:"ok"}`, алдаатай бол 503.
- [x] `vitest.config.ts` (`test/setup.ts`-ээр `.env.test` ачаална), Supertest тест.

**Дууссаны шалгуур: биелсэн.** Сервер асаж `/health` 200 `{"status":"ok","db":"ok"}` буцаасан. `vitest run` 1/1 ногоон. `tsc --noEmit` алдаагүй. `.env`-ээс `DATABASE_URL`-ийг устгавал тодорхой Монгол алдаа хэвлээд process.exit(1) (шалгасан).

**ШАЛГАХ ЦЭГ 3: дууссан.**

---

## Үе шат 4. Prisma 7 тохиргоо

- [x] `@prisma/adapter-pg@7.10.1`, `pg` аль хэдийн суусан байсан (хэрэглэгч өмнө нь хийсэн).
- [x] `npx prisma init` хэрэглэгч өмнө нь ажиллуулсан (`prisma7.config.ts` нэртэй, `schema.prisma`-д `output = "../src/generated/prisma"`). Файлын нэрийг зөв `prisma.config.ts` болгож өөрчилсөн (Prisma CLI анхдагчаар яг энэ нэрийг хайдаг).
  - generator `prisma-client` ✓, datasource-д url байхгүй ✓, url config-д ✓
- [x] `prisma.config.ts`-д `migrations.seed: "tsx prisma/seed.ts"` нэмсэн.
- [x] `src/shared/db/prisma.ts`: `PrismaPg` adapter, нэг `PrismaClient`, `Tx = Prisma.TransactionClient` экспортлосон.
- [x] `/health` энэ клиентээр `SELECT 1` хийнэ (баталгаажсан).
- [x] scripts бүгд нэмэгдсэн.

**Дууссаны шалгуур: биелсэн.** `npx prisma validate` → "The schema is valid".

---

## Үе шат 5. Өгөгдлийн загвар (М1-М5-д хэрэгтэй хүснэгтүүд)

Эх сурвалж: design 5.3.3 (бүх хүснэгт), 5.3.5 (цөм моделийн жишээ), `CLAUDE.md` 7-р хэсэг. Бүлэг бүрийн дараа `prisma migrate dev --name <нэр>` ба `prisma generate` ажиллуул.

- [x] **А бүлэг (М1, М2), migration `auth_catalog`:** `users`(Role: ADMIN/TEACHER/PARENT/STUDENT), `refresh_tokens`, `password_resets`, `teachers`, `teacher_rates`, `parents`, `branches`, `programs`, `settings`.
- [x] **Б бүлэг (М3), migration `enrollment`:** `students`, `parent_students`, `contracts` (ContractStatus: ACTIVE/PAUSED/COMPLETED), `contract_pauses`, `plan_items`.
- [x] **В бүлэг (М4), migration `scheduling`:** `classes`, `enrollments`, `lessons` (LessonStatus: SCHEDULED/CANCELLED/RESCHEDULED — "6 төлөв" диаграмын тооноос (3 гэрээ + 3 хичээл) тооцоолж гаргасан, зураг шууд харагдаагүй тул **хэрэглэгчээр баталгаажуулах**).
- [x] **Г бүлэг (М5 ба дэд бүтэц), migration `attendance_core`:** `attendance` (AttendanceStatus 5), `leave_requests`, `ledger_entries` (LedgerType: EARNING/PAYOUT/ADJUSTMENT), `audit_log`, `notification_outbox`, `idempotency_keys`, `teacher_tasks`.
- [x] **Гараар бичих хязгаарлалтын migration `constraints`:** CLAUDE.md 7-р хэсгийн жагсаалт бүхэлдээ: contracts-ийн 3 CHECK, lessons EXCLUDE (btree_gist), ledger_entries/contract_pauses/enrollments-ийн хэсэгчилсэн UNIQUE, **`pitoo_app` DB хэрэглэгч үүсгэж, audit_log/ledger_entries-д түүнээс UPDATE/DELETE REVOKE хийсэн** (ФБШ-24, шалгасан: UPDATE оролдвол "permission denied").
  - Нэмэлт: аппликейшн одоо `APP_DATABASE_URL`-аар (pitoo_app) холбогддог, `DATABASE_URL` (postgres) зөвхөн Prisma CLI-д (migrate, seed). `.env`, `.env.example`, `.env.test` гурвад нэмэгдсэн, `env.ts`, `shared/db/prisma.ts` шинэчлэгдсэн.
- [x] **`prisma/seed.ts`:** 1 админ (`.env`-ээс, must_change_password=true), 2 салбар, 2 хөтөлбөр, 2 багш (үнэлгээтэй), 5 `settings` мөр (батцын хэмжээ, 93%, 6 суудал, 24 цаг, дансны мэдээлэл). `upsert`-ээр бичигдсэн тул давтан ажиллахад давхардахгүй.
- [x] **Хязгаарлалтын тест** (`src/shared/db/constraints.test.ts`, жинхэнэ `pitoo_test` дээр): сөрөг `remaining_visits`, `totalVisits`-ээс хэтэрсэн `remaining_visits`, багшийн давхцсан хичээл, нэг хичээлд хоёр `EARNING` — 4/4 ногоон.

М6-М12-ын хүснэгтүүдийг (assessments, payments, payment_claims гэх мэт) 11.02-ны дараа нэмнэ.

**ШАЛГАХ ЦЭГ 5: дууссан, бататгах шаардлагатай зүйлтэй.** Seed өгөгдөл (админ 99001122, 2 салбар, 2 хөтөлбөр, 2 багш) `pitoo` DB-д бодитоор бичигдсэнийг psql-ээр шалгасан (Prisma Studio GUI session биш, учир нь энэ орчинд GUI нээх боломжгүй). **Хэрэглэгчээс асуух зүйл:** `LessonStatus`-ийг (SCHEDULED/CANCELLED/RESCHEDULED) Зураг 6.2-ын жинхэнэ диаграмтай тулгаж баталгаажуулаарай (Claude Docs-оор); хэрэв өөр бол шинэ migration нэмж засна.

---

## Үе шат 6. `packages/contracts`

- [x] Enum-ууд: `Role`, `ContractStatus`, `LessonStatus`, `AttendanceStatus`. Монгол шошготой map хамт (`enums.ts`).
- [x] М1-ийн схемүүд: `loginSchema`, `changePasswordSchema`, `createUserSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `updateUserStatusSchema` (`auth.schemas.ts`).
- [x] Мөнгөний схем: `moneySchema` ("40000.00" хэлбэр, `money.ts`).
- [ ] Модуль бүрийн схемийг тухайн модулийг хийх үедээ нэмнэ.

**Дууссаны шалгуур: биелсэн.** `apps/api`-аас `import { Role, loginSchema, moneySchema } from "@pitoo/contracts"` ажилласан, `tsc --noEmit` хоёр багцад алдаагүй.

---

## Үе шат 7. М1: Нэвтрэлт ба эрх

Эхлээд унш: req 4.1 (ФШ-01...06), req 5.5 (ФБШ-18...23), design 5.4.2-ын эхний 8 мөр, 8.1, ADR-004, 008.

- [x] `shared/rbac`: `authenticate` (`jwt.ts`-ээр access token шалгаад `req.user = {id, role}`), `authorize(...roles)` (403).
- [x] `POST /auth/login`: нууц үг bcrypt-аар шалгана. Буруу оролдлогоор `failed_logins` нэмэгдэж, `settings.auth_defaults`-аас уншсан тоонд (анхдагч 5, 15 мин) хүрвэл `locked_until` тавина (кодонд тоо хатуу бичээгүй, ФБШ-29). Access token (JSON) + refresh token (httpOnly/Strict cookie).
- [x] `POST /auth/refresh`: rotation. Ашиглагдсан (revoked) token дахин ирвэл тухайн хэрэглэгчийн бүх token хүчингүй.
- [x] `POST /auth/logout`
- [x] `POST /auth/password/change`: `must_change_password`-ийг арилгана, 409 буруу одоогийн нууц үгэнд.
- [x] `POST /auth/password/forgot`, `POST /auth/password/reset`: 30 минутын нэг удаагийн token, `notification_outbox`-д бичигдэж консолд хэвлэгдэнэ (SMTP хожим).
- [x] `POST /users` (админ: багш/эцэг эхийн данс, түр нууц үгтэй, хариуд буцаана), `PATCH /users/{id}/status` (идэвхгүй болгоход refresh token бүгд цуцлагдана, ADR-004).
- [x] Тест (`auth.service.test.ts`, 7 кейс): нэвтрэх амжилттай/буруу, 5 удаагийн түгжигдэх, идэвхгүй данс, refresh rotation + дахин ашиглалт илрүүлэлт, багшид админ API 403, админ шинэ багш үүсгэх.

**Олдсон, засагдсан алдаа (чухал сурах зүйл):** `prisma.$transaction`-ийн callback дотор `throw` хийвэл Prisma ТРАНЗАКЦЫГ БҮХЭЛД НЬ rollback хийдэг. Анх `login`/`refresh`-д "тоолуур нэмэх → алдаа шидэх"-ийг нэг транзакцад бичсэн нь тоолуур, token цуцлалтыг rollback-аар арилгадаг байв (тест эхлээд 500/200 буцааж илрүүлсэн). Засвар: транзакц дотор зөвхөн үр дүнгийн "outcome" тодорхойлж, транзакц амжилттай батлагдсаны ДАРАА нь throw хийх болгов.

**ШАЛГАХ ЦЭГ 7: дууссан.** Бодит сервер дээр seed админаар (99001122) нэвтрэх, `/health`, 12/12 тест (constraints 4 + health 1 + auth 7) ногоон, `tsc build` цэвэр шалгасан.

---

## Үе шат 8. М2: Суурь мэдээлэл

Унш: req 4.2, design 8.5, ADR-013.

- [ ] `/branches`, `/programs`: админ CRUD, багш зөвхөн GET. Үнийн өөрчлөлт түүхтэй (ADR-013).
- [ ] `GET /settings`, `PUT /settings`: аудиттай.
- [ ] `POST /teachers/{id}/rates`: хүчинтэй огноотой үнэлгээ. Хичээлийн цалинд тухайн өдрийн үнэлгээ хэрэглэгдэнэ.
- [ ] `shared/audit`: `writeAudit(tx, { entity, entityId, action, before, after, reason, actorId })`
- [ ] Тест.

---

## Үе шат 9. М3: Элсэлт ба гэрээ

Унш: req 4.3, 4.5-ийн ФШ-72...75, design 6.5, ADR-009, 014.

- [ ] `GET /parents?phone=`, `POST /students`: сурагч, эцэг эх, холбоосыг нэг транзакцаар үүсгэнэ. Ижил утастай эцэг эх байвал дахин ашиглана.
- [ ] `POST /students/{id}/assessments` (түвшин тогтоох)
- [ ] `POST /contracts`:
  - програмын тухайн үеийн үнийг хуулна
  - тоолуурыг `settings`-ээс тооцно: 75/3 = 25 ирэлт, 3 чөлөө
  - `rules_ack_at` заавал
- [ ] `PUT /contracts/{id}/plan`
- [ ] `POST /contracts/{id}/pause`, `POST /contracts/{id}/resume`: design 6.5-ын алхмууд, суудал хадгалах эсэх, аудит
- [ ] Тест: тоолуурын анхны утга, давхар идэвхтэй зогсолт хориглогдох, суудалгүй resume ангигүй бол 409.

**ШАЛГАХ ЦЭГ 9.**

---

## Үе шат 10. М4: Хуваарь ба анги

Унш: req 4.4, ADR-011, design 5.3.3 (classes, enrollments, lessons).

- [ ] `POST /classes`: багшийн цагийн давхцал шалгах (ФШ-25)
- [ ] `GET /classes/available` (ФШ-15)
- [ ] `POST /classes/{id}/enrollments`: 6 суудлын хязгаар. Суудал хадгалсан зогсолт тоонд орно (ФШ-20, 74).
- [ ] Хичээл үүсгэх:
  - service функц `generateLessons(fromDate, weeks)`, ирэх 4 долоо хоногийн хичээл
  - `UNIQUE(class_id, original_starts_at)` тул давтан ажиллуулахад давхардахгүй
  - `src/worker.ts`-д өдөр бүр ажиллахаар холбох
- [ ] `GET /lessons?from=&to=`: эрхээр шүүсэн календарь
- [ ] `POST /lessons/{id}/cancel`, `POST /lessons/{id}/reschedule`: мэдэгдлийг outbox-д
- [ ] Тест: давхцал 409, 7 дахь сурагч 409, хичээл үүсгэлт давтан ажиллахад давхардахгүй.

**ШАЛГАХ ЦЭГ 10.**

---

## Үе шат 11. М5: Ирц (хамгийн чухал)

Унш: req 4.5 бүхэлд нь, design 6.1 (10 алхам), 6.2 (засварын хүснэгт), 6.4, ADR-006, 007, 009, 010. `MAKEUP` төлвийн дүрэм шийдэгдсэн: `CLAUDE.md` 6.4-г үз (багцаас 1 хасагдана, чөлөөний эрх хөдлөхгүй, багшийн цалинд тооцогдоно).

- [ ] `shared/idempotency`: `Idempotency-Key` толгойтой хүсэлтийн хариуг хадгалах ба буцаах. Ирцтэй нэг транзакцад (design 6.1-ийн 9-р алхам).
- [ ] `shared/outbox`: `enqueue(tx, { recipientId, channel, template, payload })`
- [ ] payroll модулийн `recordEarning(tx, lesson, countedStudents)`: ФШ-53-ын томьёо, `Decimal`-аар
- [ ] `GET /lessons/{id}/attendance`: сурагчид "Ирсэн" анхдагчтай (ФШ-27). Түр зогсоосон гэрээ орохгүй (ФШ-73).
- [ ] `PUT /lessons/{id}/attendance`: design 6.1-ийн 1-9-р алхам яг дарааллаар:
  - эзэмшил, 24 цаг
  - гэрээнүүдийг `FOR UPDATE`
  - төлөв тооцох
  - тоолуур
  - EARNING
  - босго мэдэгдэл (ФШ-36: 4-өөс 3, ФШ-37: 0 болоход Дууссан + шалгалтын ажил)
  - outbox, аудит, idempotency
- [ ] `PATCH /attendance/{id}`: design 6.2 ба засварын хүснэгт. Багш 24 цагийн дотор, админ шалтгаантай. ADJUSTMENT мөр.
- [ ] `GET /attendance/{id}/history` (админ)
- [ ] `POST /lessons/{id}/makeups` (ФШ-31: нөхөгдөөгүй чөлөөний тоо хүртэл, 6 суудал)
- [ ] `POST /leave-requests` (ФШ-30)
- [ ] Worker: outbox-оос `FOR UPDATE SKIP LOCKED`-оор авч илгээх. Одоохондоо консол адаптер, 5 оролдлого, экспоненциал хүлээлт.
- [ ] **Тест** (хамгийн их тест энд):
  - ФШ-28, 29 хил утга (эрх 1 ба 0)
  - ФШ-32 транзакц: дунд нь алдаа гаргахад юу ч өөрчлөгдөхгүй
  - ФШ-33: 23 ба 25 цаг
  - ФШ-34: олголтын дараах засвар ADJUSTMENT болно
  - ФШ-36: мэдэгдэл нэг л удаа
  - ФШ-37: Дууссан гэрээнд энгийн ирц 409
  - ФШ-31 нөхөлт: чөлөөтэй хичээлд багц хасагдахгүй (зөвхөн чөлөөний эрх), нөхөж орсон хичээлд багц 1 хасагдана (чөлөөний эрх дахин хөдлөхгүй), нөхөлтийг заасан багшид цалин тооцогдоно
  - ФШ-31 хязгаар: 2 чөлөөтэй сурагчид 3 дахь нөхөлт нэмэхэд 409
  - design 6.2-ын засварын 4 мөр бүрээр
  - ижил `Idempotency-Key`-тэй хоёр хүсэлт нэг л удаа боловсруулагдана
  - хоёр зэрэг хүсэлт тоолуурыг давхар хасахгүй
  - өөр багшийн хичээлд 403

**ШАЛГАХ ЦЭГ 11:** тестийн тайланг хэрэглэгчид үзүүл.

---

## Үе шат 12. Frontend (М1, М5-ыг тэргүүнд)

Унш: design 5.5 бүхэлд нь.

- [ ] `apps` дотор `npm create vite@latest web -- --template react-ts`. `package.json` нэрийг `@pitoo/web` болго.
- [ ] Tailwind, shadcn/ui, React Router, TanStack Query
- [ ] `vite.config.ts`: `/api`-г `http://localhost:3000` руу proxy
- [ ] `shared/api-client`: access token санах ойд, 401 үед refresh хийгээд дахин оролдох
- [ ] `shared/format`: огноо `ОООО.СС.ӨӨ`, мөнгө `125 000 ₮`, Asia/Ulaanbaatar
- [ ] Нэвтрэх, нууц үг солих хуудас
- [ ] **Багшийн ирцийн дэлгэц** (design 5.5.2, 5.5.3; ФБШ-08):
  - утсанд, өнөөдрийн хичээлүүд
  - бүгд "Ирсэн" анхдагч
  - ирээгүйг нэг товшилтоор
  - нэг "Хадгалах" товч
  - хадгалсны дараа сервер буцаасан төлөв, үлдэгдлийг харуулна
- [ ] Админ: салбар, хөтөлбөр, багш, сурагч, гэрээ, анги үүсгэх энгийн хуудсууд
- [ ] Багш: гэрээ түр зогсоох, үргэлжлүүлэх

**ШАЛГАХ ЦЭГ 12.**

---

## Үе шат 13. Явцын хяналтын бэлтгэл (2026.11.01 хүртэл)

- [ ] Үзүүлэнгийн seed: 2 салбар, 3 багш, 15 сурагч, гэрээ, анги, 2 долоо хоногийн хичээл
- [ ] Үзүүлэх урсгал:
  1. Админ нэвтэрнэ, сурагч ба гэрээ үүсгэнэ
  2. Багш утсаар ирц бүртгэнэ, нэг сурагч ирээгүй байна
  3. Чөлөө хасагдсан, багцын үлдэгдэл, цалингийн EARNING харагдана
  4. Ирцийг засахад ADJUSTMENT, аудитын түүх харагдана
- [ ] `README.md`: суулгах, ажиллуулах алхмууд (Windows PowerShell)
- [ ] М1-М5-ын Must шаардлага бүрийн төлөв: хийгдсэн, тест байгаа эсэх. `docs/PROGRESS.md` хүснэгтээр.

**ШАЛГАХ ЦЭГ 13:** хэрэглэгчтэй хамт урсгалыг эхнээс нь дуустал туршина.

---

## Хуваарь

| Хугацаа | Үе шат |
| --- | --- |
| 10.21-10.22 | 0-5 |
| 10.23-10.24 | 6-8 |
| 10.25-10.27 | 9-10 |
| 10.28-10.30 | 11 |
| 10.30-11.01 | 12-13 |

Хоцорвол эхлээд үе шат 12-ын админ хуудсуудыг багасга (Prisma Studio-оор түр орлуулж болно). Үе шат 11-ийн тестүүдийг бүү хас.
