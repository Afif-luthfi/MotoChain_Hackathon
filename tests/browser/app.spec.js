import { test, expect } from "@playwright/test";
test("BOT networks; saved demo selection is migrated without presenting fake motors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("motochain.network", "demo");
    localStorage.setItem(
      "motochain.demo.v2",
      JSON.stringify({ motors: [{ id: "1", data: { model: "FAKE MOTOR" } }] }),
    );
  });
  await page.goto("/");
  await expect(page.getByLabel("Pilih jaringan")).toHaveValue("testnet");
  await expect(page.getByLabel("Pilih jaringan").locator("option")).toHaveText([
    "BOT Testnet",
    "BOT Mainnet",
  ]);
  await expect(page.getByText("FAKE MOTOR")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Garasi Saya" }),
  ).toBeVisible();
  await expect(
    page.getByText("Kontrak BOT Testnet belum dikonfigurasi.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hubungkan dompet", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Dompet belum tersedia");
  expect(
    await page.evaluate(() => localStorage.getItem("motochain.network")),
  ).toBe("testnet");
});
test("Mainnet selection is retained and has separate unconfigured settings", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("motochain.network", "mainnet"),
  );
  await page.goto("/#/settings");
  await expect(
    page.getByRole("heading", { name: "BOT Testnet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "BOT Mainnet", exact: true }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(2);
  await expect(page.getByLabel("Pilih jaringan")).toHaveValue("mainnet");
  expect(
    await page.evaluate(() => localStorage.getItem("motochain.network")),
  ).toBe("mainnet");
  await page.goto("/#/garage");
  await expect(
    page.getByText("Kontrak BOT Mainnet belum dikonfigurasi.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("Pilih jaringan").selectOption("testnet");
  await expect(page.getByLabel("Pilih jaringan")).toHaveValue("testnet");
});
test("old demo passport URL is rejected instead of reading an unrelated on-chain passport", async ({
  page,
}) => {
  await page.goto("/#/passport/demo/1");
  await expect(page.getByRole("alert")).toContainText(
    "jaringan yang tidak didukung",
  );
  await expect(
    page.getByRole("heading", { name: "Informasi motor saya" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Buka Garasi Saya", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Garasi Saya" }),
  ).toBeVisible();
});
test("mobile navbar, disconnected registration and guide work without a demo fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("link", { name: "Tambah Catatan Servis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tambah Catatan Servis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hubungkan dompet pemilik" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Daftarkan motor", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Periksa pendaftaran" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Lewati ke konten" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("link", { name: "Panduan", exact: true }).click();
  await expect(page.getByRole("button", { name: /Reset demo/ })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});


test("public passport search is separate from the wallet garage", async ({ page }) => {
  await page.goto("/#/garage");
  await expect(page.getByLabel("Cari ID paspor blockchain")).toHaveCount(0);
  await page.getByRole("link", { name: "Cek Paspor Motor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cek Paspor Motor" })).toBeVisible();
  await page.getByLabel("Cari ID paspor blockchain").fill("4");
  await page.getByRole("button", { name: "Buka paspor", exact: true }).click();
  await expect(page).toHaveURL(/#\/passport\/testnet\/4$/);
  await expect(page.getByRole("heading", { name: "Paspor Motor Publik" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Motor saya", exact: true })).toHaveCount(0);
});
