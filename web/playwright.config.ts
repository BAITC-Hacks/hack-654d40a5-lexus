import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.SANA_URL || "http://localhost:8080",
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CHROME_EXECUTABLE
      ? { executablePath: process.env.CHROME_EXECUTABLE }
      : {},
    trace: "retain-on-failure",
  },
  reporter: "list",
});
