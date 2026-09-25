import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5180",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node server/index.js",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort",
      url: "http://127.0.0.1:5180",
      env: {
        VITE_TESTNET_CONTRACT: "",
        VITE_MAINNET_CONTRACT: "",
        VITE_API_URL: "",
      },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
