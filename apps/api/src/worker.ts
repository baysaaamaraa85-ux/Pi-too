import "dotenv/config";
import { env } from "./config/env.js";
import { logger } from "./shared/logger.js";
import {
  LESSON_HORIZON_WEEKS,
  generateLessons,
  todayInUlaanbaatar,
} from "./modules/scheduling/scheduling.service.js";
import { processOutbox } from "./modules/notifications/notifications.worker.js";
import { buildChannelRegistry } from "./modules/notifications/notifications.registry.js";

const GENERATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // өдөр бүр
// ФБШ-06: мэдэгдэл 5 минутын дотор илгээгдэх ёстой тул 10 секунд тутам шалгана.
const OUTBOX_INTERVAL_MS = 10_000;

async function runGenerateLessons() {
  try {
    const result = await generateLessons(todayInUlaanbaatar(), LESSON_HORIZON_WEEKS);
    logger.info({ created: result.count }, "Хичээл үүсгэх ажил дууслаа");
  } catch (error) {
    logger.error({ err: error }, "Хичээл үүсгэх ажил амжилтгүй боллоо");
  }
}

const registry = buildChannelRegistry(env);
let outboxRunning = false;

async function runOutbox() {
  if (outboxRunning) return; // өмнөх цикл дуусаагүй бол алгасна
  outboxRunning = true;
  try {
    const result = await processOutbox(registry, { appOrigin: env.APP_ORIGIN });
    if (result.sent + result.retried + result.failed > 0) {
      logger.info(result, "Мэдэгдэл илгээх цикл дууслаа");
    }
  } catch (error) {
    logger.error({ err: error }, "Мэдэгдэл илгээх цикл амжилтгүй боллоо");
  } finally {
    outboxRunning = false;
  }
}

logger.info({ channels: Object.keys(registry) }, "Worker процесс асав");
void runGenerateLessons();
setInterval(() => void runGenerateLessons(), GENERATE_INTERVAL_MS);
void runOutbox();
setInterval(() => void runOutbox(), OUTBOX_INTERVAL_MS);
