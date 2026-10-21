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

- [ ] `node -v` (24.x), `npm -v`, `docker -v`, `git -v` ажиллуулж хувилбаруудыг тэмдэглэ.
- [ ] Үндсэн `package.json`, `docker-compose.yml`, `apps/api/package.json`-ийг уншиж, доорх үе шатуудтай зөрөх зүйлийг жагсаа.
- [ ] `apps/api/package.json`-д `"type"` түлхүүр нэг л удаа байгаа эсэхийг шалга.
- [ ] git репо эсэхийг шалга. Үгүй бол `git init` ажиллуул.

**ШАЛГАХ ЦЭГ 0:** олдсон зөрүүг хэрэглэгчид тайлбарлаад, засах эсэхийг асуу.

---

## Үе шат 1. Monorepo суурь

Зорилго: гурван багцыг нэг `npm install`-ээр удирдаж, хооронд нь импортлох боломжтой болгох.

- [ ] Үндсэн `package.json`:
  - `"name": "pi-too"`, `"private": true`, `"workspaces": ["apps/*", "packages/*"]`
  - scripts: `"dev:api"`, `"dev:web"`, `"test"`, `"db:up": "docker compose up -d"`
- [ ] `tsconfig.base.json`: `strict`, `target ES2023`, `module/moduleResolution NodeNext`, `skipLibCheck`. Багц бүрийн `tsconfig.json` үүнийг `extends` хийнэ.
- [ ] `.gitignore`: `node_modules`, `.env`, `dist`, `**/src/generated`, `coverage`
- [ ] `.editorconfig`, Prettier тохиргоо (`.prettierrc`: 2 зай, давхар хашилт, `printWidth` 100)
- [ ] `packages/contracts`:
  - `package.json` (`"name": "@pitoo/contracts"`, `"type": "module"`, `"exports"` нь `src/index.ts`)
  - хоосон `src/index.ts`
- [ ] **Workspace руу шилжих:**
  1. `apps/api/node_modules` ба `apps/api/package-lock.json`-ийг устга.
  2. Үндсэн хавтаснаас `npm install` ажиллуул. Нэг `package-lock.json` үндсэн хавтаст үүснэ.
  3. Prisma 7.10.1 хэвээр эсэхийг `npm ls prisma @prisma/client`-ээр шалга.
- [ ] `apps/api`-д `@pitoo/contracts`-ийг хамаарал болгон нэм (`"@pitoo/contracts": "*"`).

**Дууссаны шалгуур:** үндсэн хавтаснаас `npm install` алдаагүй дуусна. `apps/api` дотроос `import {} from "@pitoo/contracts"` TypeScript-ийн алдаа өгөхгүй.

**ШАЛГАХ ЦЭГ 1:** хэрэглэгч `chore: monorepo суурь` commit хийнэ.

---

## Үе шат 2. Өгөгдлийн сан

- [ ] `docker-compose.yml`-д `db` сервис байна:
  - `postgres:16`, `container_name: pitoo-db`, хэрэглэгч `postgres`, нууц үг `dev`, DB `pitoo`, порт `5432`, `pgdata` volume, `restart: unless-stopped`
- [ ] Тестийн өгөгдлийн санг нэм. Хөгжүүлэлтийн өгөгдлийг тест устгахгүй байх ёстой. Хоёр сонголтоос нэгийг хэрэглэгчтэй тохир:
  - (а) Ижил контейнерт `pitoo_test` DB-г init script-ээр (`docker/postgres/init.sql`) үүсгэх
  - (б) 5433 порттой тусдаа `db-test` сервис
- [ ] `docker compose up -d` ажиллуулж, `docker ps`-д `pitoo-db` `Up` төлөвтэй эсэхийг шалга.

**Дууссаны шалгуур:** `docker exec -it pitoo-db psql -U postgres -c "\l"` нь `pitoo` болон тестийн DB-г харуулна.

---

## Үе шат 3. API-ийн араг яс

- [ ] `apps/api/tsconfig.json` нь base-ийг extends хийнэ. `rootDir: src`, `outDir: dist`, `types: ["node"]`.
- [ ] scripts:
  - `"dev": "tsx watch src/server.ts"`
  - `"worker": "tsx watch src/worker.ts"`
  - `"build": "tsc"`
  - `"test": "vitest"`
- [ ] `src/config/env.ts`:
  - `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_ORIGIN` утгуудыг Zod-оор шалгана.
  - Буруу эсвэл дутуу бол алдааг тодорхой хэвлээд `process.exit(1)`.
- [ ] `.env.example` (нууцгүй жишээ) ба `.env` (хэрэглэгч өөрөө бөглөнө)
- [ ] `src/shared/errors/`:
  - `DomainError` класс (code, status, title, detail, extra)
  - `problemDetails` middleware: RFC 9457, 404 ба 500-ийг ч хамарна
  - Zod алдааг 422 болгох
- [ ] `src/shared/logger.ts`: pino, хүсэлт бүрийн ID-тай JSON лог
- [ ] `src/app.ts`:
  - Express 5 app, `express.json()`, cookie-parser, лог middleware
  - `/api/v1` router, алдааны middleware хамгийн сүүлд
- [ ] `src/server.ts`: портыг сонсоно
- [ ] `GET /health`: DB холболтыг шалгаж `{ status: "ok", db: "ok" }` буцаана. DB-гүй үед 503.
- [ ] `vitest.config.ts` ба `/health`-ийн Supertest тест

**Дууссаны шалгуур:**
- `npm run dev -w @pitoo/api` асна.
- `curl http://localhost:3000/health` нь 200 буцаана.
- `npm test -w @pitoo/api` ногоон.
- `.env`-ээс `DATABASE_URL`-ийг устгахад процесс ойлгомжтой алдаатай зогсоно.

**ШАЛГАХ ЦЭГ 3:** хэрэглэгч commit хийнэ.

---

## Үе шат 4. Prisma 7 тохиргоо

- [ ] `npm i -E @prisma/adapter-pg@7.10.1 pg -w @pitoo/api` ба `npm i -D @types/pg -w @pitoo/api`
- [ ] `apps/api` дотор `npx prisma init --datasource-provider postgresql --output ../src/generated/prisma`
- [ ] Үүссэн `prisma.config.ts` ба `schema.prisma`-г хэрэглэгчид үзүүлж Prisma 7-ийн бүтцийг тайлбарла:
  - generator `prisma-client`
  - datasource-д url байхгүй, url нь config-д
  - seed-ийн тохиргоо config-д
- [ ] `prisma.config.ts`-д `migrations.seed: "tsx prisma/seed.ts"` нэм.
- [ ] `src/shared/db/prisma.ts`:
  - `PrismaPg` adapter-аар нэг `PrismaClient` instance
  - `Tx` төрлийг экспортлох (транзакцын клиентийн төрөл, service-үүд `tx: Tx` параметр авна)
- [ ] `/health` энэ клиентээр `SELECT 1` хийнэ.
- [ ] scripts: `"db:migrate": "prisma migrate dev"`, `"db:generate": "prisma generate"`, `"db:studio": "prisma studio"`, `"db:seed": "prisma db seed"`

**Дууссаны шалгуур:** `npx prisma validate` амжилттай.

---

## Үе шат 5. Өгөгдлийн загвар (М1-М5-д хэрэгтэй хүснэгтүүд)

Эх сурвалж: design 5.3.3 (бүх хүснэгт), 5.3.5 (цөм моделийн жишээ), `CLAUDE.md` 7-р хэсэг. Бүлэг бүрийн дараа `prisma migrate dev --name <нэр>` ба `prisma generate` ажиллуул.

- [ ] **А бүлэг (М1, М2), migration `auth_catalog`:**
  - `users` (role enum: ADMIN, TEACHER, PARENT, STUDENT), `refresh_tokens`, `password_resets`
  - `teachers`, `teacher_rates`, `parents`
  - `branches`, `programs`, `settings`
  - **ШАЛГАХ ЦЭГ 5А:** schema-г хэрэглэгчид үзүүлж хянуулна. Хэрэглэгч үүнийг удирдагчтайгаа (Claude chat) шалгаж магадгүй.
- [ ] **Б бүлэг (М3), migration `enrollment`:**
  - `students`, `parent_students`
  - `contracts` (status enum: ACTIVE, PAUSED, COMPLETED. Design 6.4-ийн төлвийн машинтай тулга)
  - `contract_pauses`, `plan_items`
- [ ] **В бүлэг (М4), migration `scheduling`:**
  - `classes`, `enrollments`
  - `lessons` (status enum: SCHEDULED, CANCELLED, RESCHEDULED гэх мэт. Design 6.4-өөс шалга)
- [ ] **Г бүлэг (М5 ба дэд бүтэц), migration `attendance_core`:**
  - `attendance` (5 төлөвт enum), `leave_requests`
  - `ledger_entries` (EARNING, PAYOUT, ADJUSTMENT)
  - `audit_log`, `notification_outbox`, `idempotency_keys`
  - `teacher_tasks` (ФШ-37-ийн шалгалтын ажил)
- [ ] **Гараар бичих хязгаарлалтын migration `constraints`:** `CLAUDE.md` 7-р хэсгийн жагсаалт бүхэлдээ. Хязгаарлалт бүрийн дээр ямар шаардлагад хэрэгтэйг SQL сэтгэгдлээр бич.
- [ ] **`prisma/seed.ts`:**
  - Нэг админ: утас ба түр нууц үгийг `.env`-ээс авна, `must_change_password = true`
  - 2 салбар, 2 хөтөлбөр, 2 багш, үнэлгээтэй
  - `settings`-ийн анхдагч утгууд: багц 75 академик цаг, нэг ирэлт 3 академик цаг, 3 чөлөө, 93%, 6 суудал, 24 цаг
- [ ] **Хязгаарлалтын тест** (интеграц, тестийн DB дээр):
  - сөрөг `remaining_visits` бичигдэхгүй
  - нэг багшид давхцсан хичээл бичигдэхгүй
  - нэг хичээлд хоёр EARNING бичигдэхгүй

М6-М12-ын хүснэгтүүдийг (assessments, payments, payment_claims гэх мэт) 11.02-ны дараа нэмнэ.

**ШАЛГАХ ЦЭГ 5:** `prisma studio`-оор seed өгөгдлийг хэрэглэгчтэй хамт хар. Хэрэглэгч commit хийнэ.

---

## Үе шат 6. `packages/contracts`

- [ ] Enum-ууд: `Role`, `ContractStatus`, `LessonStatus`, `AttendanceStatus`. Монгол шошготой map хамт.
- [ ] М1-ийн схемүүд: `loginSchema` (утас эсвэл имэйл, нууц үг), `changePasswordSchema`, `createUserSchema`
- [ ] Мөнгөний схем: `"40000.00"` хэлбэрийн тэмдэгт мөр
- [ ] Модуль бүрийн схемийг тухайн модулийг хийх үедээ нэмнэ.

---

## Үе шат 7. М1: Нэвтрэлт ба эрх

Эхлээд унш: req 4.1 (ФШ-01...06), req 5.5 (ФБШ-18...23), design 5.4.2-ын эхний 8 мөр, 8.1, ADR-004, 008.

- [ ] `shared/rbac`:
  - `authenticate` (access token шалгана, `req.user` = { id, role })
  - `authorize(...roles)`
- [ ] `POST /auth/login`: нууц үг шалгах. Буруу оролдлогоор данс түгжих (`failed_logins`, `locked_until`, ФБШ-22-ын тоог req-ээс ав). Access token + refresh cookie.
- [ ] `POST /auth/refresh`: rotation. Ашиглагдсан token дахин ирвэл хэрэглэгчийн бүх token хүчингүй.
- [ ] `POST /auth/logout`
- [ ] `POST /auth/password/change`: `must_change_password`-ийг арилгана.
- [ ] `POST /auth/password/forgot`, `POST /auth/password/reset`: 30 минутын нэг удаагийн token. Имэйлийг одоохондоо outbox-д бичээд консолд хэвлэнэ.
- [ ] `POST /users` (админ: багш, эцэг эхийн данс, түр нууц үгтэй), `PATCH /users/{id}/status`
- [ ] Тест:
  - нэвтрэх амжилттай ба буруу
  - түгжигдэх
  - refresh rotation ба дахин ашиглалт
  - үүрэг бүрээр 403
  - идэвхгүй данс нэвтрэхгүй

**ШАЛГАХ ЦЭГ 7.**

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
