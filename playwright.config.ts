import { defineConfig } from "@playwright/test";

// System QA suite. Runs ONLY against the local stand-in (videos/devstack): the globalSetup refuses to run unless
// the Supabase URL is http://127.0.0.1:*. Start the stack first:
//   node videos/devstack/stack.mjs        (terminal 1: local Postgres + PostgREST + auth emulator)
//   npm run test:e2e                       (starts videos/devstack/dev.mjs on :3100 if it is not already running)
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: "e2e/.results/report.json" }]],
  use: {
    baseURL: "http://localhost:3100",
    channel: "chrome",
    locale: "en-CA",
    timezoneId: "America/Toronto",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "phone",
      use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: "node videos/devstack/dev.mjs",
    url: "http://localhost:3100/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
