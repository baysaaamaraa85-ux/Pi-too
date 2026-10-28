import "dotenv/config";
import { logger } from "./shared/logger.js";
import {
  LESSON_HORIZON_WEEKS,
  generateLessons,
  todayInUlaanbaatar,
} from "./modules/scheduling/scheduling.service.js";

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // өдөр бүр

async function runGenerateLessons() {
  try {
    const result = await generateLessons(todayInUlaanbaatar(), LESSON_HORIZON_WEEKS);
    logger.info({ created: result.count }, "Хичээл үүсгэх ажил дууслаа");
  } catch (error) {
    logger.error({ err: error }, "Хичээл үүсгэх ажил амжилтгүй боллоо");
  }
}

logger.info("Worker процесс асав");
void runGenerateLessons();
setInterval(() => void runGenerateLessons(), RUN_INTERVAL_MS);
