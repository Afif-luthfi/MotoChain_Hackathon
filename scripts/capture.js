import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.goto("http://127.0.0.1:5173");
await page.screenshot({
  path: "docs/screenshots/home-desktop.png",
  fullPage: true,
});
await page.goto("http://127.0.0.1:5173/#/service/testnet");
await page
  .getByRole("heading", { name: "Tambah Catatan Servis", exact: true })
  .waitFor();
await page.screenshot({
  path: "docs/screenshots/passport-desktop.png",
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "docs/screenshots/passport-mobile.png",
  fullPage: true,
});
await page.goto("http://127.0.0.1:5173");
await page.screenshot({
  path: "docs/screenshots/home-mobile.png",
  fullPage: true,
});
await browser.close();
