import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3101"
  },
  webServer: [
    {
      command: "npx next dev --port 3101 --hostname 127.0.0.1",
      cwd: ".",
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:4101",
        NOAFLAKE_API_BASE_URL: "http://127.0.0.1:4101"
      },
      port: 3101,
      reuseExistingServer: false,
      timeout: 120000
    },
    {
      command: "npm.cmd run dev",
      cwd: "../backend",
      env: {
        PORT: "4101",
        NOAFLAKE_STORE_PATH: ".playwright-store/backend-store.json",
        NOAFLAKE_RESET_STORE: "true",
        NOAFLAKE_ALLOW_TEST_RESET: "true"
      },
      port: 4101,
      reuseExistingServer: false,
      timeout: 120000
    }
  ]
});
