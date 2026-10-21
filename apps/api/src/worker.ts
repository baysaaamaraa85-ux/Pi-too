import "dotenv/config";
import { logger } from "./shared/logger.js";
import { generateLessons } from "./modules/scheduling/scheduling.service.js";

const GENERATE_LESSONS_WEEKS = 4; // ФШ-23: ирэх 4 долоо хоногийн хичээл
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // өдөр бүр

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function runGenerateLessons() {
  try {
    const result = await generateLessons(todayUtcMidnight(), GENERATE_LESSONS_WEEKS);
    logger.info({ created: result.count }, "Хичээл үүсгэх ажил дууслаа");
  } catch (error) {
    logger.error({ err: error }, "Хичээл үүсгэх ажил амжилтгүй боллоо");
  }
}

logger.info("Worker процесс асав");
void runGenerateLessons();
setInterval(() => void runGenerateLessons(), RUN_INTERVAL_MS);
