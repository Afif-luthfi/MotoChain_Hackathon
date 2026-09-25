import { test, expect } from "@playwright/test";
import { mockOwnerPassport } from "./wallet-fixture.js";

async function openForm(page, configured = true) {
  await mockOwnerPassport(page);
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({
      json: {
        configured,
        provider: "Gemini",
        model: "test-model",
        localOnly: true,
      },
    }),
  );
  await page.goto("/#/service/testnet/1");
}
const result = {
  draft: {
    date: "2026-09-20",
    odometer: "12500",
    complaint: "",
    action: "Penggantian oli mesin",
    parts: "Oli mesin",
  },
  warnings: ["Keluhan tidak tercantum."],
  missing: ["complaint"],
  provider: "Gemini",
  model: "test-model",
};
test("Gemini preview needs consent and explicit application, preserving missing manual fields", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/ai/receipt", async (route) => {
    calls++;
    expect(route.request().postDataJSON().consent).toBe(true);
    await route.fulfill({ json: result });
  });
  await openForm(page);
  await page
    .getByLabel("Keluhan atau kebutuhan servis", { exact: true })
    .fill("Keluhan manual yang dipertahankan");
  await page
    .getByLabel("Teks nota", { exact: false })
    .fill("20 September 2026. Ganti oli mesin. Odometer 12500 km.");
  const read = page.getByRole("button", { name: "Baca nota dengan Gemini" });
  await expect(read).toBeDisabled();
  await page.getByRole("checkbox", { name: /setuju mengirim/ }).check();
  await read.click();
  await expect(
    page.getByRole("heading", { name: "Draf dari Gemini" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Pekerjaan yang dilakukan", { exact: true }),
  ).toHaveValue("");
  const apply = page.getByRole("button", { name: "Terapkan ke formulir" });
  await expect(apply).toBeDisabled();
  await page.getByRole("checkbox", { name: /telah memeriksa draf/ }).check();
  await apply.click();
  await expect(
    page.getByLabel("Pekerjaan yang dilakukan", { exact: true }),
  ).toHaveValue("Penggantian oli mesin");
  await expect(
    page.getByLabel("Keluhan atau kebutuhan servis", { exact: true }),
  ).toHaveValue("Keluhan manual yang dipertahankan");
  expect(calls).toBe(1);
  await page
    .getByRole("button", { name: "Periksa catatan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Simpan catatan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ubah catatan" }).click();
  await expect(
    page.getByLabel("Pekerjaan yang dilakukan", { exact: true }),
  ).toHaveValue("Penggantian oli mesin");
});
test("AI missing key, provider error and unsupported image leave manual form usable", async ({
  page,
}) => {
  await openForm(page, false);
  await expect(page.getByText(/AI belum diaktifkan/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Baca nota dengan Gemini" }),
  ).toBeDisabled();
  await page.getByLabel("Foto nota", { exact: false }).setInputFiles({
    name: "nota.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page.getByRole("alert")).toContainText("JPG");
  await page
    .getByLabel("Pekerjaan yang dilakukan", { exact: true })
    .fill("Isi manual tetap bekerja");
  await expect(
    page.getByLabel("Pekerjaan yang dilakukan", { exact: true }),
  ).toHaveValue("Isi manual tetap bekerja");
  await page.unroute("**/api/ai/status");
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({
      json: { configured: true, provider: "Gemini", model: "test" },
    }),
  );
  await page.getByRole("button", { name: "Periksa status AI" }).click();
  await page.route("**/api/ai/receipt", (r) =>
    r.fulfill({ status: 429, json: { error: "Kuota Gemini sedang habis." } }),
  );
  await page.getByLabel("Teks nota", { exact: false }).fill("Servis motor");
  await page.getByRole("checkbox", { name: /setuju mengirim/ }).check();
  await page.getByRole("button", { name: "Baca nota dengan Gemini" }).click();
  await expect(page.getByRole("alert")).toContainText("Kuota");
  await expect(
    page.getByLabel("Pekerjaan yang dilakukan", { exact: true }),
  ).toHaveValue("Isi manual tetap bekerja");
});
test("mobile receipt image preview and reset have no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openForm(page);
  await page.getByLabel("Foto nota", { exact: false }).setInputFiles({
    name: "nota.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lX8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("img", { name: "Pratinjau nota yang dipilih" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hapus foto" }).click();
  await expect(
    page.getByRole("img", { name: "Pratinjau nota yang dipilih" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("public Gemini signs an access challenge and sends a bearer session before receipt extraction", async ({
  page,
}) => {
  await mockOwnerPassport(page);
  await page.addInitScript(() => {
    const request = window.ethereum.request;
    window.ethereum.request = async (args) => {
      if (args.method === "personal_sign") return "0x" + "11".repeat(65);
      return request(args);
    };
  });
  await page.route("**/api/ai/status", (r) =>
    r.fulfill({
      json: { configured: true, localOnly: false, requiresAuth: true },
    }),
  );
  let logins = 0,
    receipts = 0;
  await page.route("**/api/auth/challenge", (r) =>
    r.fulfill({
      json: {
        nonce: "fixture-nonce",
        message: "Motochain Service\nAuthorize receipt AI access",
      },
    }),
  );
  await page.route("**/api/auth/session", (r) => {
    logins++;
    expect(r.request().postDataJSON().nonce).toBe("fixture-nonce");
    return r.fulfill({
      json: { token: "test-session", expires: Date.now() + 3600000 },
    });
  });
  await page.route("**/api/ai/receipt", (r) => {
    receipts++;
    expect(r.request().headers().authorization).toBe("Bearer test-session");
    return r.fulfill({ json: result });
  });
  await page.goto("/#/service/testnet/1");
  await expect(
    page.getByText(/MetaMask akan meminta tanda tangan/),
  ).toBeVisible();
  await page.getByLabel("Teks nota", { exact: false }).fill("Ganti oli mesin");
  await page.getByRole("checkbox", { name: /setuju mengirim/ }).check();
  await page.getByRole("button", { name: "Baca nota dengan Gemini" }).click();
  await expect(
    page.getByRole("heading", { name: "Draf dari Gemini" }),
  ).toBeVisible();
  expect(logins).toBe(1);
  expect(receipts).toBe(1);
});
