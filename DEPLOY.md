# Railway дээр байршуулах заавар

Энэ баримт системийг Railway дээр байршуулах алхмуудыг бичнэ. Шийдвэрийн шалтгаан, зардал, давуу ба сул тал нь `docs/adr-017-railway.md`-д (ADR-017) байна. Энэ репо дотор юу ч өөрөө deploy хийдэггүй: Railway-д нэвтэрч, доорх алхмуудыг та өөрөө гүйцэтгэнэ.

## 1. Бүтэц

Design 7-р бүлгийн таван контейнер хэвээр, VPS-ийн оронд Railway-ийн таван service болсон.

| Railway service | Хаанаас | Үүрэг | Нийтийн домэйн | Volume |
| --- | --- | --- | --- | --- |
| `web` | `deploy/docker/web.Dockerfile` | Caddy: React (PWA)-ийг түгээж, `/api`, `/uploads`, `/health`-ийг `api` руу дамжуулна | Тийм (цорын ганц) | Үгүй |
| `api` | `deploy/docker/api.Dockerfile` | REST API (`SERVICE_ROLE=api`) | Үгүй | `/data/uploads` |
| `worker` | `deploy/docker/api.Dockerfile` | Outbox, хичээл үүсгэх (`SERVICE_ROLE=worker`), яг нэг replica | Үгүй | Үгүй |
| `Postgres` | Railway-ийн Postgres template | Өгөгдлийн сан | Үгүй (Public Access асаахгүй) | Автомат |
| `backup` | `deploy/docker/backup.Dockerfile` | Өдөр бүр `pg_dump`, S3 руу илгээж, 30 хоног хадгална (cron) | Үгүй | Үгүй |

Гаднаас зөвхөн `web` хүртэх бөгөөд хөтөч Railway edge-ээр (HTTPS) түүнтэй харилцана. `web` нь `api`-тай, `api`, `worker`, `backup` нь `Postgres`-тэй Railway-ийн дотоод сүлжээгээр (`*.railway.internal`, http) холбогдоно.

Яагаад `web` нь `/api`-г дамжуулдаг вэ: вэб `/api/v1/...` гэж харьцангуй замаар дууддаг, мөн refresh cookie `SameSite=Strict` тул хуудас ба API ижил домэйнээс ирэх ёстой.

**Яагаад `railway.json` байхгүй вэ.** Railway "Config as Code" (`railway.json`, `railway.toml`)-ийг deprecated болгосон: 2026-12-01-ээс файлууд уншигдахаа болино, шинэ service-д ашиглах боломжгүй. Шинэ "Infrastructure as Code" (`.railway/railway.ts`)-ийн баримтад Dockerfile-ийн замыг зааж өгөх тухай тодорхой заалт олдсонгүй. Тиймээс тохиргоог (1) Dockerfile дотор, (2) service-ийн Dockerfile Path тохиргоогоор (`deploy/docker/<нэр>.Dockerfile`; `RAILWAY_DOCKERFILE_PATH` хувьсагч ч адил), (3) доорх service тохиргоогоор хийнэ.

## 2. Урьдчилсан нөхцөл

- Railway данс. **Pro багц ($20/сар) санал болгоно.** Hobby багцын volume 5 GB-аар хязгаарлагдаж, лог 7 хоног хадгалагдана. Арилжааны хэрэглээний нөхцөлийг Railway-ийн Terms-ээс өөрөө шалга, би баталгаажуулж чадаагүй.
- Энэ репо GitHub дээр (`origin`). Railway-д GitHub-аа холбоно.
- Нөөцлөлтөд S3-тэй тохирох bucket (Railway Buckets эсвэл бусад). Заавал биш боловч ФБШ-16 (нөөцлөлт, 30 хоног) шаардана.
- Дараах гурван нууц утгыг PowerShell дээр өөрөө үүсгэнэ (3 удаа ажиллуулж 3 өөр утга авна). Хаана ч commit хийхгүй:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Алхам

Бүх хувьсагчийн бүрэн загвар: [`deploy/railway.env.example`](deploy/railway.env.example). Service-ийн нэрийг яг `Postgres`, `api`, `worker`, `web`, `backup` гэж өг: хувьсагчид `${{api.PORT}}` гэх мэтээр нэрээр иш татна.

### 3.1 Төсөл ба өгөгдлийн сан

1. Railway дээр шинэ төсөл үүсгээд **Postgres** template нэм (service нэр: `Postgres`).
2. **Postgres хувилбарыг шалга.** Design нь PostgreSQL 16 гэсэн. Template-ийн хувилбарыг Railway-ийн баримт тодорхой хэлээгүй тул `Postgres` service-ийн Data/Query хэсэгт `SELECT version();` ажиллуулж үз. Анхны deploy дээр template нь **PostgreSQL 18.6** (`postgres-ssl:18`) байсан. Бүх migration PG 18 дээр локалаар болон Railway дээр амжилттай орж, `pitoo_app`-ийн эрх (ФБШ-24) зөв байгааг шалгасан, тиймээс 16 руу буулгах шаардлагагүй. Backup service-ийн `PG_MAJOR`-ыг 18 болго.
3. Public Access (TCP Proxy)-ийг асаахгүй. api, worker, backup нь дотоод сүлжээгээр холбогдоно (ФБШ-21).

### 3.2 api

> Service бүрийн **Start Command**-ыг тодорхой тавь (api, worker: `api-start`). Railway GitHub-ээс автоматаар үүсгэсэн service-д `npm run dev`, `worker` гэх мэт хуучин утга үлддэг бөгөөд Dockerfile-ийн `CMD`-ийг дарж бичдэг. Settings > Build > Dockerfile Path-ыг `deploy/docker/api.Dockerfile` болго, Custom Build Command-ыг хоосон үлдээ.

1. **New Service > GitHub Repo**: энэ репо, салбар `deploy/railway` (main руу merge хийсний дараа `main` болгож солино). Нэр: `api`.
2. **Variables**: `deploy/railway.env.example`-ийн `api` хэсгийг Raw Editor-оор оруулна. `RAILWAY_RUN_UID=0`, `PORT=3000`, `TRUST_PROXY=3`-ыг орхиж болохгүй.
3. **Settings > Volumes**: volume нэмж, mount path `/data/uploads` (ФШ-78: багш, салбарын зураг). `RAILWAY_RUN_UID=0` нь volume root-ийн эзэмшилтэй тул шаардлагатай (Railway-ийн баримт).
4. **Settings > Deploy**:
   - **Pre-deploy Command**: `npm run db:deploy`
     Энэ нь эхлээд `pitoo_app` DB хэрэглэгчийг `APP_DATABASE_URL`-ийн нууц үгтэйгээр үүсгэж (`db:bootstrap`), дараа нь `prisma migrate deploy` ажиллуулна. Migration амжилтгүй бол шинэ хувилбар гарахгүй, хуучин нь ажилласаар үлдэнэ (Railway: pre-deploy алдаатай бол deploy үргэлжлэхгүй).
   - **Healthcheck Path**: `/health`
5. **Networking**: нийтийн домэйн **үүсгэхгүй**.

### 3.3 web

1. Ижил репо, салбар. Нэр: `web`. Variables: `web` хэсэг (`PORT=8080`, `API_UPSTREAM`). **Start Command**: `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile` (доорх "Deploy хийхэд олдсон"-ыг үз).
2. **Settings > Deploy > Healthcheck Path**: `/healthz` (Caddy өөрөө хариулна, api унасан ч web амьд).
3. **Networking > Generate Domain**. Гарсан домэйнийг `api`-ийн `APP_ORIGIN`-д (`https://${{web.RAILWAY_PUBLIC_DOMAIN}}`) аль хэдийн иш татсан. Хувьсагч өөрчлөгдсөний дараа `api`-г дахин deploy хий.
4. Хувийн домэйн (жишээ нь `app.pitoo.mn`) холбовол Railway өгсөн DNS бичлэгийг домэйн бүртгэгч дээр нэмнэ.

### 3.4 worker

1. Ижил репо, салбар. Нэр: `worker`. Variables: `worker` хэсэг (`SERVICE_ROLE=worker`, бусдыг `api`-аас иш татна).
2. **Нийтийн домэйн, healthcheck, volume хэрэггүй.** Replica заавал 1 (хоёр байвал outbox давхар боловсруулагдах эрсдэл).
3. Лог дотор `"Worker процесс асав"` гарсан эсэхийг шалга.

### 3.5 Анхны өгөгдөл (seed), нэг удаа

Админ данс ба журмын тохиргоо (`settings`: 75 цаг, 3 чөлөө, 93%, 6 суудал, 24 цаг, нэвтрэлтийн түгжээ гэх мэт) үүсгэх шаардлагатай.

1. `api` service-ийн Pre-deploy Command-ыг **түр** `npm run db:deploy && npx tsx prisma/seed.ts` болгоод deploy хий.
2. Deploy дууссаны дараа **шууд** `npm run db:deploy` болгож буцаа.
3. `NODE_ENV=production` үед seed **demo өгөгдөл үүсгэхгүй**: жишээ багш (репод бичигдсэн `Teacher123!` нууц үгтэй), жишээ салбар, хөтөлбөр, хуурамч дансны мэдээлэл (`payment_account`) орохгүй. Зөвхөн админ ба журмын тохиргоо үүснэ (D-92).
4. Салбар, хөтөлбөр, багш нар, **төлбөрийн дансны жинхэнэ мэдээллийг** админ UI-аар оруулна. `payment_account` үүсээгүй байх тул эцэг эхэд харагдах төлбөрийн заавар хоосон байна.
5. `ADMIN_PHONE` утсаар, `ADMIN_TEMP_PASSWORD`-оор нэвтэрч нууц үгээ соль. Дараа нь `ADMIN_TEMP_PASSWORD`-ийг `api` хувьсагчаас **устга**.

### 3.6 backup (заавал биш, санал болгоно)

1. Ижил репо. Нэр: `backup`. Variables: `backup` хэсэг. `PG_MAJOR` нь Postgres service-ийн хувилбартай ижил эсвэл түүнээс шинэ байх ёстой (`pg_dump` нь өөрөөсөө шинэ серверээс татгалздаг).
2. **Settings > Cron Schedule**: `0 20 * * *`. Railway cron нь **UTC**, тиймээс энэ нь Улаанбаатарын 04:00. Хоёр ажиллалтын завсар 5 минутаас багагүй байх ёстой.
3. Эхний удаа `BACKUP_DRY_RUN=1` хувьсагчтай ажиллуулж лог дээр `Дамп бэлэн` гарахыг шалга, дараа нь устгана.
4. **Сэргээх туршилт хийх ёстой** (ФБШ-16: RPO 24 цаг, RTO 4 цагаас ихгүй). Хүлээлгэн өгөхөөс өмнө нөөцөөс сэргээж хугацааг хэмж:

```powershell
# bucket-аас хамгийн сүүлийн .dump-ийг татаад, цэвэр Postgres дээр сэргээх
docker run --rm -d --name restore-test -e POSTGRES_PASSWORD=test -p 5499:5432 postgres:16
docker cp pitoo-YYYYMMDDTHHMMSSZ.dump restore-test:/tmp/b.dump
docker exec restore-test pg_restore --no-owner -U postgres -d postgres /tmp/b.dump
```

## 4. Deploy-ийн дараах шалгалт

| Шалгах | Хүлээгдэх үр дүн |
| --- | --- |
| `https://<домэйн>/health` | `{"status":"ok","db":"ok"}` |
| Нүүр хуудас, `/teacher/today` шууд нээх (refresh хийх) | Хуудас нээгдэнэ (SPA fallback) |
| Админаар нэвтрэх, нууц үг солих | Амжилттай |
| Багш бүртгэж, зураг оруулах, дараа нь `api`-г redeploy хийх | Зураг алга болохгүй (volume ажиллаж байна) |
| `worker` лог | `Worker процесс асав` |
| `api` лог, нийтийн хуудсаар 5-аас олон хүсэлт (`/api/v1/public/placement-requests`) өөр өөр утаснаас | 5-аас хойш 429, хуурамч `X-Forwarded-For` толгой нөлөөлөхгүй. Шалгасан: `TRUST_PROXY=3` үед зөв, 2 үед `req.ip` нь Railway edge-ийн хаяг болж rate limit алдаатай |
| Дараа өдөр `backup` лог | `Илгээлээ: s3://...` |
| Chrome DevTools > Application > Manifest, Service Workers | Manifest алдаагүй, `sw.js` бүртгэгдсэн |

## 5. Багш нарт суулгаж өгөх (PWA)

Дэлгүүрээс татахгүй. Багш холбоосыг утсан дээрээ нээгээд:

- **Android (Chrome):** цэс (гурван цэг) > "Нүүр дэлгэцэнд нэмэх" эсвэл "Апп суулгах".
- **iPhone (Safari заавал):** хуваалцах товч > "Нүүр дэлгэцэнд нэмэх". iOS дээр push мэдэгдэл зөвхөн нүүр дэлгэцэнд суулгасан апп-д ажилладаг (ADR-005).

Сүлжээгүй үед өнөөдрийн хичээлийн жагсаалт 24 цаг хүртэл хадгалагдана (`vite.config.ts`-ийн `workbox`).

## 6. Шинэчлэх, буцаах

- `main` (эсвэл заасан салбар)-д push хийхэд Railway дахин build хийнэ. Эхлээд `api` pre-deploy-оор migration хийж, амжилттай бол шинэ хувилбар гарна.
- Migration бүр **шинэ** migration файл байна. Хэрэглэгдсэн migration-ийг засахгүй (CLAUDE.md). Нэг л тохиолдол: `20261021135641_constraints`-ийг нууц үгийг салгахын тулд ADR-017-ийн хүрээнд зассан (`docs/decisions-log.md` D-91).
- Буцаах: Railway-ийн Deployments хэсгээс өмнөх deploy-г Redeploy. Өгөгдлийн схем ахисан бол буцаахаас өмнө нөөцөөс сэргээх шаардлагатай эсэхийг бод.
- Хувилбар гаргахын өмнө `backup` service-ийг гараар ажиллуулж нөөц ав (design 7).

## 7. Хөгжүүлэлтийн орчин

Өөрчлөлтгүй: `docker compose up -d`, `npm run dev:api`, `npm run dev:web`. `npm run db:migrate` одоо эхлээд `pitoo_app` үүргийг `.env`-ийн `APP_DATABASE_URL`-ээр үүсгэж, дараа нь `prisma migrate dev` ажиллуулна. `docker/postgres/init.sql` өөрчлөгдөөгүй.

Ганц анхааруулга: өмнө нь `prisma migrate dev` хийсэн сан дээр `constraints` migration-ийн checksum өөрчлөгдсөн тул "migration was modified" гэж гарна. Өөр хуулбар дээр дараах SQL-ийг ажиллуулна (энэ репоны хоёр локал сан `pitoo`, `pitoo_test` дээр шинэчилсэн):

```sql
UPDATE _prisma_migrations SET checksum = '<migration.sql-ийн sha256>'
WHERE migration_name = '20261021135641_constraints';
```

## 8. Анхны deploy хийхэд олдсон зүйлс (2026.11.18)

Эдгээр нь баримтад байхгүй, бодит deploy дээр илэрсэн. Дараагийн удаа үүнийг дагана.

- **Railway-ийн автомат service**: GitHub репо холбоход Railway workspace бүрээр service үүсгэж, `npm run dev --workspace=...`, `worker` зэрэг Start Command, Custom Build Command өгдөг. Эдгээрийг Settings-ээс цэвэрлэж, дээрх тодорхой утгаар солих хэрэгтэй. CLI/API-аар `null` өгөхөд цэвэрлэгддэггүй, тодорхой утга (`api-start`) эсвэл хоосон мөр өгнө.
- **`railway service redeploy`** нь хуучин deploy-ийн тохиргоог (хуучин start command, pre-deploy) дахин ашигладаг. Шинэ тохиргоог хэрэгжүүлэхийн тулд шинэ deploy эхлүүл (GitHub push, эсвэл variable өөрчлөлт).
- **Pre-deploy** нь shell биш: `&&` бүхий команд хэрэгтэй бол `sh -c '...'`-ээр бүрх. Нэг `npm run db:deploy` бол хэвээр.
- **TRUST_PROXY=3**: API-д ирэх `X-Forwarded-For` нь `клиент, Railway edge, Railway дотоод` гэсэн 3 хаягтай. Railway edge клиентийн илгээсэн хуурамч толгойг хаядаг. 2 гэж тавибал `req.ip` нь хүн бүрт өөр Railway edge-ийн хаяг болж, rate limit учир дутуу ажилладаг байсан.
- **Windows (Git Bash)**: `railway volume update --mount-path /data/uploads` дээр Git Bash `/data/uploads`-ыг Windows зам болгодог, `MSYS_NO_PATHCONV=1`-ээр ажиллуул.
- **Pre-deploy-оор нэг удаагийн ажил** (seed, эрх шалгах) хийхдээ ажлыг дуусмагц pre-deploy-г `npm run db:deploy` болгож буцаа.

## 9. Мэдэгдэж буй хязгаарлалт

Шалгасан ба шалгаагүй зүйлс (2026.11.18-ны анхны deploy):

- **Шалгасан**: Postgres 18.6 дээр `btree_gist` бүхий бүх migration орсон, `pitoo_app` нь `audit_log`, `ledger_entries`-д UPDATE/DELETE хийж чадахгүй (42501), нийтийн хаягаар нэвтрэлт, PWA-ийн толгой, `/health`, worker-ийн асалт, rate limit-ийн жинхэнэ IP.

- **Шалгаагүй**: volume-д зураг бичих (`RAILWAY_RUN_UID=0`). Анхны багш, салбарын зураг оруулахдаа `EACCES` алдаа гарвал `api`-ийн логийг харна, мөн redeploy хийсний дараа зураг үлдсэн эсэхийг шалга.
- Backup-ийн S3 хэсгийг жинхэнэ bucket-тэй туршаагүй. Хуурамч `aws`-ээр илгээх, 30 хоногийн устгалын логикийг л шалгасан.
- Image том (api ~1.3 GB): `prisma` болон `tsx` нь devDependency тул бүх хамаарлыг суулгасан. Хурд, хэмжээ асуудал болвол `@pitoo/contracts`-ийг build хийж, зөвхөн production хамаарлыг үлдээх боломжтой.
- Content-Security-Policy толгой нэмээгүй (Google Fonts, inline style-д нөлөөлж болзошгүй). Хожим нэмэх нь аюулгүй байдлын сайжруулалт.
