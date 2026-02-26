import { devices, PlaywrightTestConfig } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const config: PlaywrightTestConfig = {
  testDir: "./tests",
  timeout: 3000 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    actionTimeout: 0,
    baseURL: "http://localhost:3000",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
   webServer: {
    command: `docker run -p 3000:3000 leo-web-playground`,
    url: "http://localhost:3000/",
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
  },
};

export default config;
