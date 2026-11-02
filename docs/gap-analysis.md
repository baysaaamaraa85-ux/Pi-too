# Gap analysis: шаардлага ба хэрэгжүүлэлтийн зөрүү

Эх сурвалж: `docs/thesis.md` Хавсралт А (ФШ), Хавсралт Б (ФБШ) ба Хүснэгт 4.5, 4.6. Репогийн бодит
байдлыг 2026.10.28-нд кодыг уншиж тогтоосон. Энэ файл бол ажлын төлөвлөгөө: шат бүрийн төгсгөлд
шинэчилнэ.

Төлөв: **Хэрэгжсэн** (код ажиллаж, дор хаяж нэг автомат тест эсвэл гараар шалгасан), **Хэсэгчлэн**
(зарим хэсэг байгаа), **Хийгдээгүй**.

Баганад "Шат" нь ажлын төлөвлөгөөний шатыг (1-12) заана.

## 1. Функционал шаардлага

### М1. Нэвтрэлт ба эрх

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-01 | Хэрэгжсэн | POST /auth/login, `auth.service.ts`, `/login`, `auth.service.test.ts` | | |
| ФШ-02 | Хэрэгжсэн | `authorize()` middleware, `users.role`, BOLA тестүүд (portal, scheduling) | Үүрэг бүрээр эрхгүй endpoint-ын бүрэн автомат тест | 4, 12 |
| ФШ-03 | Хэрэгжсэн | POST /teachers, /parents, /students, POST /users/{id}/reset-password, `/admin/teachers`, `/admin/parents`, `/admin/students`, `directory.service.test.ts`, `e2e/01-users.spec.ts` | | |
| ФШ-04 | Хэрэгжсэн | `parent_students`, GET /portal/summary, `ChildPicker` | | |
| ФШ-05 | Хэсэгчлэн | POST /auth/password/forgot, reset; `password_resets` | Имэйл илгээх суваг байхгүй (outbox илгээгч, SMTP) | 8 |
| ФШ-06 | Хэрэгжсэн | PATCH /users/{id}/status (refresh token хүчингүй, аудит), дэлгэрэнгүй хуудасны товч | | |

### М2. Суурь мэдээлэл

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-07 | Хэрэгжсэн | /branches, `/admin/catalog`, `catalog.service.test.ts` | | |
| ФШ-08 | Хэрэгжсэн | /programs, ADR-013 тест | | |
| ФШ-09 | Хэрэгжсэн | /settings (аудиттай), `settings` хүснэгт | Админы Тохиргооны хуудсанд шинэ түлхүүрүүдийн засвар (давтлагын босго, 60% сул сэдэв) | 6 |
| ФШ-10 | Хэрэгжсэн | POST /teachers/{id}/rates, багшийн дэлгэрэнгүйд маягт, `payroll.ledger.test.ts` (14 ба 15-ны хил) |  |  |
| ФШ-11 | Хэрэгжсэн | GET /setup/status (дараалал, түгжээг сервер тооцно), `/admin/setup`, `directory.service.test.ts` | | |

### М3. Элсэлт, гэрээ, түр зогсолт

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-12 | Хэрэгжсэн | POST /enrollments (нэг транзакц), `/admin/enroll`, `/teacher/enroll`, `enrollment.atomic.test.ts`, `e2e/03-enroll.spec.ts` | | |
| ФШ-13 | Хэрэгжсэн | GET /parents?phone=, `registerStudent` нэг транзакц, тест | | |
| ФШ-14 | Хэрэгжсэн | POST /students/{id}/assessments (type PLACEMENT), элсэлтийн шидтэн, сурагчийн дэлгэрэнгүйн график |  |  |
| ФШ-15 | Хэрэгжсэн | GET /classes/available (салбар, гараг, багшаар шүүнэ; багшийн нэр, суудал), элсэлтийн 3-р алхам, үргэлжлүүлэх цонх, тест | Хөтөлбөрөөр шүүхгүй (D-14) | |
| ФШ-16 | Хэрэгжсэн | POST /contracts, `rules_ack_at` NOT NULL | | |
| ФШ-17 | Хэрэгжсэн | `registerStudent`/`createContract`, settings-ээс 75/3, тест | | |
| ФШ-18 | Хэрэгжсэн | PUT /contracts/{id}/plan (эзэмшлийн шалгалттай), `/teacher/students` Төлөвлөгөө цонх, тест | | |
| ФШ-72 | Хэрэгжсэн | POST /contracts/{id}/pause, `/teacher/students` "Урт хугацааны чөлөө", тест, e2e | | |
| ФШ-73 | Хэрэгжсэн | Түр зогсоосон гэрээ ирцийн жагсаалтад гарахгүй, PUT 409, `attendance.record.test.ts` |  |  |
| ФШ-74 | Хэрэгжсэн | `pauseContract` (holdSeat=false бол бүртгэл хаана), `enrollment.rules.test.ts` | | |
| ФШ-75 | Хэрэгжсэн | POST /contracts/{id}/resume, `/teacher/students` "Үргэлжлүүлэх", тест, e2e | | |
| ФШ-78 | Хэрэгжсэн | /public/branches, `/programs`, `/teachers`, `/contact` | | |
| ФШ-79 | Хэрэгжсэн | POST /placement-requests (rate-limit), `/admin/requests`, тест | | |

### М4. Хуваарь ба анги

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-19 | Хэрэгжсэн | POST /classes, `classes-page`, DELETE /classes/{id} | | |
| ФШ-20 | Хэрэгжсэн | `enrollContractInClassInTx` (6 ба 7 дахь сурагч тест) | | |
| ФШ-21 | Хэрэгжсэн | Нэг ангид өөр хөтөлбөрийн гэрээ, `enrollment.rules.test.ts` | | |
| ФШ-22 | Хэрэгжсэн | `weekly_lessons` тохиргоо, POST /enrollments 409 `weekly-lessons-out-of-range` + баталгаажуулалт, тест, e2e | | |
| ФШ-23 | Хэрэгжсэн | GET /lessons, worker, `generateLessons`, анги үүсэхэд шууд | | |
| ФШ-24 | Хэрэгжсэн | POST /lessons/{id}/cancel, reschedule, тест | | |
| ФШ-25 | Хэрэгжсэн | EXCLUDE constraint, 409 | | |

### М5. Ирц ба чөлөө

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-26 | Хэрэгжсэн | `AttendanceStatus` enum, `attendance.rules.ts`, `attendance.rules.test.ts` |  |  |
| ФШ-27 | Хэрэгжсэн | GET /lessons/{id}/attendance, `/teacher/attendance/:id`, `/admin/attendance/:id`, `e2e/05-attendance.spec.ts` |  |  |
| ФШ-28 | Хэрэгжсэн | `decideStatus`, PUT /lessons/{id}/attendance, `attendance.record.test.ts` (эрх 1 ба 0) |  |  |
| ФШ-29 | Хэрэгжсэн | `decideStatus`, клиентийн төлвийг үл хүлээнэ, `attendance.record.test.ts` |  |  |
| ФШ-30 | Хэрэгжсэн | POST /leave-requests, ирцийн дэлгэц урьдчилан "Ирээгүй" + "Чөлөө хүссэн" шошго, e2e |  |  |
| ФШ-31 | Хэрэгжсэн | POST /lessons/{id}/makeups, GET makeup-candidates, `attendance.record.test.ts` (2 чөлөөнд 3 дахь нөхөлт 409, 6 суудал) |  |  |
| ФШ-32 | Хэрэгжсэн | `saveAttendance` нэг транзакц + `runIdempotent`, ЧХ-2 тест (`attendance.record.test.ts`) |  |  |
| ФШ-33 | Хэрэгжсэн | `loadLessonForWrite`, settings `editWindowHours`, `attendance.record.test.ts` (23 ба 25 цаг), e2e |  |  |
| ФШ-34 | Хэрэгжсэн | PATCH /attendance/{id}, `settleAttendanceEarningInTx` (ADJUSTMENT), `attendance.record.test.ts` Хүснэгт 3.15-ын 4 мөр |  |  |
| ФШ-35 | Хэрэгжсэн | audit_log, GET /attendance/{id}/history (админ), `attendance.record.test.ts` | Түүхийг UI-д харуулах (шат 10) | 10 |
| ФШ-36 | Хэрэгжсэн | `crossedToThree` (4-өөс 3), outbox `package_ending`, `attendance.record.test.ts` | Илгээх суваг (шат 8) | 8 |
| ФШ-37 | Хэрэгжсэн | Гэрээ Дууссан, `teacher_tasks` EXAM, засварт Идэвхтэй руу буцна, `attendance.record.test.ts` |  |  |

### М6. Сургалтын явц

| Код | Төлөв | Юу дутуу | Шат |
| --- | --- | --- | --- |
| ФШ-38 | Хэрэгжсэн | POST /students/{id}/assessments (сэдвийн оноо, нийт хувь давхар шалгана), `assessment_topics` (CHECK 0-100), UI, `progress.service.test.ts` |  |
| ФШ-39 | Хэрэгжсэн | Багцын шалгалт < 93% (settings) бол 3 үнэгүй давтлагын эрх, 92.9 ба 93.0 хил, `progress.service.test.ts` |  |
| ФШ-40 | Хэрэгжсэн | 3 давтлага бүртгэгдэж 4 дэх нь 409, багц ба цалинд нөлөөлөхгүй, `progress.service.test.ts` |  |
| ФШ-41 | Хэрэгжсэн | GET /students/{id}/progress, шугаман график + хүснэгт (`ProgressChart`), `progress.service.test.ts` | 9 |
| ФШ-42 | Хэрэгжсэн | Сүүлийн 3 сорилын сул сэдэв (60% босго settings), 55% тодорч 65% тодрохгүй, `progress.service.test.ts` |  |
| ФШ-43 | Хэрэгжсэн | 13 ба 25 дахь ирэлтэд `teacher_tasks` MEETING, уулзалт бүртгэхэд биелнэ, `progress.service.test.ts` | 10 |
| ФШ-44 | Хэрэгжсэн | POST /lessons/{id}/notes, GET /contracts/{id}/notes (дотоод/хуваалцсан), UI, `progress.service.test.ts` | 9 |
| ФШ-45 | Хэрэгжсэн | POST /contracts/{id}/meetings, гэрээний `meetingsCount` (админ ба багш), UI, `progress.service.test.ts` |  |

### М7. Төлбөр ба өр

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-46 | Хэрэгжсэн | POST /contracts/{id}/payments (Idempotency-Key, аудит), `/admin/payments`, сурагчийн дэлгэрэнгүй, `payments.service.test.ts` |  |  |
| ФШ-47 | Хэрэгжсэн | Төлөв хадгалагдахгүй, SUM-аас (`shared/payments/payment-status.ts`): 600 000 / 400 000 = 200 000 Дутуу, `payments.service.test.ts` |  |  |
| ФШ-48 | Хэрэгжсэн | GET /debts (салбар, багш, хоног), нийт өр, `/admin/payments` Өртэй гэрээ, `payments.service.test.ts` | Нийт өр ФШ-69 тайлантай (шат 10) | 10 |
| ФШ-49 | Хэрэгжсэн | Эцэг эхийн карт: үлдэгдэл, төлөв, дансны мэдээлэл (settings), гүйлгээний утга + хуулах товч, `portal.service.test.ts` |  |  |
| ФШ-50 | Хасагдсан (W) | | Шаардлагаас хасагдсан | |
| ФШ-51 | Хэрэгжсэн | Багшид зөвхөн Бүрэн/Үлдэгдэлтэй (ирцийн дэлгэц, GET /contracts), дүн байхгүй, `payments.service.test.ts` |  |  |
| ФШ-52 | Хэрэгжсэн | POST /payments/{id}/cancel (шалтгаан заавал, CHECK), PATCH /payments/{id} (шалтгаан, аудит before/after), `payments.service.test.ts` |  |  |
| ФШ-76 | Хэрэгжсэн | POST /payment-claims (нэг PENDING, DB partial UNIQUE), батлах/татгалзах, мэдэгдэл outbox-д, `payments.service.test.ts`, e2e | Илгээх суваг (шат 8) | 8 |
| ФШ-77 | Хэрэгжсэн | Карт дээр Хүлээгдэж байна / Төлөгдсөн / Дутуу төлөгдсөн / Төлөгдөөгүй (тооцоолсон), `payments.service.test.ts`, e2e |  |  |

### М8. Цалин ба олголт

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-53 | Хэрэгжсэн | `recordAttendanceEarningInTx`, ирцийн мөр бүрт нэг EARNING (ADR-017), `attendance.record.test.ts` (5 000 x 4 x 2 = 40 000) |  |  |
| ФШ-54 | Хэрэгжсэн | `effectsOf(...).counted` ирцийн төлвөөр, төлбөрөөс хамааралгүй (`attendance.rules.test.ts`) |  |  |
| ФШ-55 | Хэрэгжсэн | POST /payouts (advisory lock, Idempotency-Key, 409 баталгаажуулалт), `/admin/payroll`, `payroll.ledger.test.ts`, e2e |  |  |
| ФШ-56 | Хэрэгжсэн | GET /ledger (сурагч, салбар, төрөл, огнооны шүүлт), `/admin/payroll` (30 с refetch), `payroll.ledger.test.ts`, e2e |  |  |
| ФШ-57 | Хэрэгжсэн | Тасралтгүй үлдэгдэл SUM (-50 000 + 80 000 = 30 000), `payroll.ledger.test.ts` |  |  |
| ФШ-58 | Хэрэгжсэн | `/teacher/salary` (хичээлээр бүлэглэсэн), GET /ledger эзэмшлийн шалгалт, `payroll.ledger.test.ts`, e2e |  |  |
| ФШ-59 | Хэрэгжсэн | GET /reports/payroll?format=xlsx|pdf (exceljs, pdfkit), нийлбэр тэнцүү, `payroll.ledger.test.ts` |  |  |

### М9. Мэдэгдэл

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-60 | Хэсэгчлэн | `enqueue()`, цуцлахад outbox мөр | Илгээх процесс байхгүй | 8 |
| ФШ-61 | Хэсэгчлэн | outbox `attendance_recorded`, `attendance_updated` (эцэг эхийн сувгаар) | Илгээх процесс (шат 8) | 8 |
| ФШ-62 | Хийгдээгүй | `parents.notify_channels` | Web Push, SMTP, эцэг эх сувгаа сонгох | 8 |
| ФШ-63 | Хийгдээгүй | `notification_outbox.status` | Хүргэлтийн төлөв, админы жагсаалт | 8 |
| ФШ-64 | Хийгдээгүй | | SMS адаптерын интерфейс (C, ТӨ-01) | 8 |

### М10-М12

| Код | Төлөв | Хаана байгаа | Юу дутуу | Шат |
| --- | --- | --- | --- | --- |
| ФШ-65 | Хэсэгчлэн | `/portal`, GET /portal/summary | Сүүлийн сорилын дүн, дөрвөн карт 360 px-д гүйлгэлтгүй | 9 |
| ФШ-66 | Хэрэгжсэн | Төлбөрийн route PARENT/ADMIN, сурагчид 403, бусдын гэрээнд 403 (`payments.service.test.ts`, `portal.service.test.ts`) | Порталын бусад хэсэг (шат 9) | 9 |
| ФШ-67 | Хэсэгчлэн | GET /portal/students/{id}/attendance | Дууссан багц бүрээр, багцын шалгалтын дүн | 9 |
| ФШ-68 | Хэсэгчлэн | `/admin` (хүсэлтийн тоо) | Үлдэгдэлтэй гэрээ, сөрөг үлдэгдэлтэй багш картууд, шүүлттэй жагсаалт | 10 |
| ФШ-69 | Хийгдээгүй | | Сарын тайлан | 10 |
| ФШ-70 | Хийгдээгүй | `/teacher` (өнөөдрийн хичээл) | Ирц бөглөөгүй хичээл, уулзалтын сануулга | 10 |
| ФШ-71 | Хийгдээгүй | | Салбар, багш шилжилт (C) | 10 |

## 2. Функционал бус шаардлага

| Код | Төлөв | Хаана байгаа, юу дутуу | Шат |
| --- | --- | --- | --- |
| ФБШ-01 | Хэсэгчлэн | Хил утгын тест 52 нийт, мөнгөн тооцооных бараг үгүй; 40 дүрмийн тест хүрэх ёстой | 4, 5, 7, 12 |
| ФБШ-02 | Хэрэгжсэн | NUMERIC(12,2), Prisma Decimal, 10 000 мөрийн нийлбэр 0 зөрүү (`payroll.ledger.test.ts`), web-д BigInt нийлбэр |  |  |
| ФБШ-03 | Хийгдээгүй | Ачааллын тест (k6) | 12 |
| ФБШ-04 | Хийгдээгүй | Route бүрийн code splitting (bundle 600 kB-аас том), Lighthouse | 11 |
| ФБШ-05 | Хэрэгжсэн | GET /payroll/summary нэг GROUP BY, 30 багш x 200 мөр < 10 с (`payroll.ledger.test.ts`) |  |  |
| ФБШ-06 | Хийгдээгүй | Outbox илгээгч worker | 8 |
| ФБШ-07 | Хийгдээгүй | 1 000 сурагчийн ачааллын seed | 12 |
| ФБШ-08 | Хэсэгчлэн | Ирцийн дэлгэц, 2 товшилт, e2e-д 30 секундээс бага (автомат). Багш нартай UAT-ийг би хийхгүй |  |  |
| ФБШ-09 | Хийгдээгүй | UAT, миний хамрах хүрээнээс гадуур | |
| ФБШ-10 | Хэсэгчлэн | `e2e/02-mobile-admin.spec.ts`: админы 6 хуудас 360 px-д хэвтээ гүйлгэлтгүй; бусад хуудсыг шат бүрт нэмнэ | 4, 9, 11 |
| ФБШ-11 | Хэсэгчлэн | `format/date.ts`, `money.ts`; бүх дэлгэцийн хяналт | 2-10 |
| ФБШ-12 | Хэсэгчлэн | Ирц засах, төлбөр цуцлах, олголт баталгаажуулах цонхтой. Нөхөлт нэмэх, гэрээ зогсоох цонх хэвээр |  |  |
| ФБШ-13 | Хийгдээгүй | Өнгөний ялгарал 4.5:1 шалгаагүй (C) | 11 |
| ФБШ-14 | Хийгдээгүй | GET /health (db), outbox насны шалгалт дутуу | 12 |
| ФБШ-15 | Хэсэгчлэн | Idempotency-Key заавал (PUT ирц, POST нөхөлт), давтан илгээлт тест | Офлайн дараалал (шат 11) | 11 |
| ФБШ-16 | Хийгдээгүй | backup контейнер | 12 |
| ФБШ-17 | Хэрэгжсэн | Ирц, багц, чөлөө, цалин, мэдэгдэл, олголт, төлбөр+аудит+claim нэг транзакц |  |  |
| ФБШ-18 | Хэрэгжсэн | bcrypt, 8+ тэмдэгт | |
| ФБШ-19 | Хэрэгжсэн | 15 минут, 7 хоног, httpOnly cookie, rotation | |
| ФБШ-20 | Хэрэгжсэн | BOLA тест: portal, scheduling, ирц, цалин, явц, тэмдэглэл, төлбөр |  |  |
| ФБШ-21 | Хийгдээгүй | Caddy TLS | 12 |
| ФБШ-22 | Хэрэгжсэн | 5 буруу оролдлого, 15 минут түгжих | |
| ФБШ-23 | Хэрэгжсэн | Элсэлтийн 4-р алхам: журмын огноо, зөвшөөрөл заавал (`consent_at`, `rules_ack_at`), 422 тест | |
| ФБШ-24 | Хэрэгжсэн | REVOKE migration, апп `pitoo_app`, `constraints.test.ts` | |
| ФБШ-25 | Хийгдээгүй | Хөтчийн шалгалт | 11 |
| ФБШ-26 | Хийгдээгүй | Coverage тайлан тохируулаагүй | 12 |
| ФБШ-27 | Хийгдээгүй | OpenAPI Zod-оос | 12 |
| ФБШ-28 | Хийгдээгүй | Сувгийн интерфейс | 8 |
| ФБШ-29 | Хэсэгчлэн | settings: 75/3 цаг, 3 чөлөө, 6 суудал, 2-4 хичээл, 24 цаг, 93%, 3 давтлага, 60% сул сэдэв, дансны мэдээлэл | Тохиргооны хуудсанд шинэ түлхүүрүүдийн засвар (шат 12) | 12 |
| ФБШ-30 | Хийгдээгүй | Docker Compose бүрэн, README | 12 |
| ФБШ-31 | Хэрэгжсэн | 409 `payout-needs-confirmation` (үлдэгдлээс их, ирц бөглөгдөөгүй), баталгаажуулах цонх, `payroll.ledger.test.ts`, e2e |  |  |

## 3. Хүснэгт 4.6-ын зөрүүнүүдийн төлөв

| Зөрүү | Төлөв | Тайлбар |
| --- | --- | --- |
| Нийтийн сайт | Хэрэгжсэн | ФШ-78, 79; нийтийн endpoint-д rate-limit байгаа |
| UI сан ба фонт | Хэрэгжсэн | Өөрийн shared/ui; гарчгийн фонтыг Ө, Ү үсгээр харуулж шалгах (шат 11) |
| Хүснэгтийн тоо | Хэсэгчлэн | 26 хүснэгт; `assessment_topics, lesson_notes, parent_meetings, payments, payment_claims, push_subscriptions` М6-М9-тэй хамт |
| Аудитын эрх | Хэрэгжсэн | REVOKE migration, апп `pitoo_app` |
| Элсэлтийн эрх | Хэрэгжсэн | `/teacher/enroll`, `/admin/enroll` нэг endpoint; зөвхөн өөрийн ангид (403) |
| Мэдэгдэл илгээх | Хийгдээгүй | Шат 8 |
| Эцэг эхийн портал | Хэсэгчлэн | Шат 9 |
| Тестийн тоо | Хэсэгчлэн | Шат 4, 5, 12 |
| ФШ-15, 18, 74, 21 тусгай тест | Хэрэгжсэн (шат 1) | `enrollment.rules.test.ts`; ФШ-72-ын "өнгөрсөн огноо" нөхцөл кодонд байгаагүй тул нэмсэн |
