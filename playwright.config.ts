import { defineConfig } from "@playwright/test";
import { E2E, apiEnv } from "./e2e/env.mjs";

// Браузер: машин дээр суусан Microsoft Edge (Chromium), тусад нь татахгүй.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${E2E.webPort}`,
    channel: "msedge",
    locale: "mn-MN",
    timezoneId: "Asia/Ulaanbaatar",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx tsx src/server.ts",
      cwd: "apps/api",
      env: apiEnv(),
      url: `http://localhost:${E2E.apiPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
    },
    {
      command: `npx vite --port ${E2E.webPort} --strictPort`,
      cwd: "apps/web",
      env: { VITE_API_TARGET: `http://localhost:${E2E.apiPort}` },
      url: `http://localhost:${E2E.webPort}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
