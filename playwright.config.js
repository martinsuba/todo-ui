import { defineConfig, devices } from "@playwright/test";

// Page acceptance tests run against the built dist/todo.html (run `npm run build` first).
export default defineConfig({
  testDir: "tests/acceptance",
  testMatch: "*.spec.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { timezoneId: "Europe/Bratislava", locale: "en-GB", colorScheme: "light" },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
