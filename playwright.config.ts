import { defineConfig, devices } from "@playwright/test";

// E2E runs against a deployed URL (CI: staging) or local `npm run dev`.
// E2E_BASE_URL=https://neon-tide-staging.kristian-dermody-personal-account.workers.dev npm run e2e
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 4 * 60 * 1000,
  globalTimeout: 20 * 60 * 1000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8787",
    trace: "on-first-retry",
    // Shortens result holds (see app.js) so full games run quickly; visuals are covered by the static cues.
    reducedMotion: "reduce",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    // --mute-audio: belt and braces with the app-level mute set in e2e/fixtures.ts.
    { name: "android", use: { ...devices["Pixel 7"], launchOptions: { args: ["--mute-audio"] } } },
  ],
});
