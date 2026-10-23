import { defineConfig } from "@playwright/test";
import { releaseEnvironment } from "./scripts/release-environment";

const { baseURL } = releaseEnvironment();

export default defineConfig({
  testDir: "./tests/release",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    extraHTTPHeaders: { "x-real-ip": "127.0.0.1" },
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.RELEASE_BASE_URL
    ? undefined
    : {
        command: "bun server.js",
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 90_000,
        env: {
          PORT: new URL(baseURL).port,
          BETTER_AUTH_URL: baseURL,
          BETTER_AUTH_SECRET: "isolated-diatrack-release-test-secret",
          ALLOW_REGISTRATION: "true",
          ADMIN_EMAIL: "",
          NODE_ENV: "production",
        },
      },
});
