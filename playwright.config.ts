import { devices, PlaywrightTestConfig } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();
// Default to staging unless TEST_MODE=production is provided.
const env = process.env.TEST_MODE ?? "staging";

// Run additional browsers on CI; local runs stay fast with Chromium only.
const browsersList = process.env.CI
  ? [
      {
        name: "firefox",
        use: {
          ...devices["Desktop Firefox"],
        },
      },

      {
        name: "webkit",
        use: {
          ...devices["Desktop Safari"],
        },
      },
    ]
  : [];

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
    baseURL:
      env === "production"
        ? "https://play.leo-lang.org"
        : "https://stage-pg.leo-lang.org",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },

    ...browsersList,
  ],
};

export default config;
