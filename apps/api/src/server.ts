import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./shared/logger.js";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API сервер асав");
});
