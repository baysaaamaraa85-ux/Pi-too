import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Тест NODE_ENV, DATABASE_URL (pitoo_test)-ийг .env-ийн оронд эндээс авна.
// env.ts module эхлээд энэ файлыг дуудаж байж байршуулагддаг тул (setupFiles
// нь test файлуудаас өмнө ачаалагддаг) дараа дуудагдах import бүр зөв утгыг харна.
const dir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(dir, "../.env.test"), override: true });
