import { chromium } from "@playwright/test";
import { mockOwnerPassport } from "../tests/browser/wallet-fixture.js";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await mockOwnerPassport(page);
await page.goto("http://127.0.0.1:5173/#/service/testnet/1");
await page.getByRole("heading", { name: "Dari nota ke catatan." }).waitFor();
await page.screenshot({
  path: "docs/screenshots/ai-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "docs/screenshots/ai-mobile.png",
  fullPage: true,
});
await browser.close();
