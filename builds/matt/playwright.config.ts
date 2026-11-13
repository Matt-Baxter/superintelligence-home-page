import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Load the local test database settings (.env.local is git-ignored).
if (existsSync(".env.local") && !process.env.DATABASE_URL) {
  process.loadEnvFile(".env.local");
}

const remote = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: "./tests/acceptance",
  // One shared test database, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Set PW_CHROMIUM_PATH to use an already-installed Chromium instead of
        // running `npx playwright install chromium`.
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: remote
    ? undefined
    : [
        {
          command: "node tests/fixtures/serve.mjs",
          url: "http://localhost:4100/feeds/lab.xml",
          reuseExistingServer: true,
        },
        {
          command: "next dev --port 3000",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120_000,
          env: { SOURCES: "fixtures", CRON_SECRET: "test-secret" },
        },
      ],
});
