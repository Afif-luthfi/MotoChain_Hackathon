import { test, expect } from "@playwright/test";
import fs from "node:fs";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, Wallet, getBytes } from "ethers";

test("one owner registers and saves on EVM; other wallets and legacy contracts cannot write", async ({
  page,
}) => {
  test.setTimeout(90000);
  const engine = ganache.provider({
    logging: { quiet: true },
    chain: { chainId: 968, hardfork: "shanghai" },
    wallet: { totalAccounts: 3 },
    miner: { timestampIncrement: 0 },
  });
  const provider = new BrowserProvider(engine, undefined, { cacheTimeout: -1 });
  const signer = await provider.getSigner(0);
  const accounts = await engine.request({ method: "eth_accounts", params: [] });
  const keys = engine.getInitialAccounts();
  const artifact = JSON.parse(
    fs.readFileSync("src/generated/MotochainService.json"),
  );
  const contract = await new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    signer,
  ).deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  let selected = accounts[0];
  const errors = [];
  let forceLegacy = false;
  let metadataUploads = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/metadata") && request.method() === "POST")
      metadataUploads++;
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("testWalletRpc", async (payload) => {
    if (
      forceLegacy &&
      payload.method === "eth_call" &&
      payload.params[0]?.data?.startsWith(
        contract.interface.getFunction("WORKFLOW_VERSION").selector,
      )
    )
      throw new Error("execution reverted");
    if (["eth_accounts", "eth_requestAccounts"].includes(payload.method))
      return [selected];
    if (payload.method === "wallet_switchEthereumChain") return null;
    if (payload.method === "personal_sign")
      return new Wallet(keys[selected].secretKey).signMessage(
        getBytes(payload.params[0]),
      );
    return engine.request(payload);
  });
  await page.addInitScript(
    ({ address }) => {
      localStorage.setItem("motochain.network", "testnet");
      localStorage.setItem("motochain.contract.testnet", address);
      const listeners = {};
      window.ethereum = {
        request: (payload) => window.testWalletRpc(payload),
        on: (event, fn) => {
          (listeners[event] ||= []).push(fn);
        },
        removeListener: (event, fn) => {
          listeners[event] = (listeners[event] || []).filter((x) => x !== fn);
        },
      };
      window.testAccountChanged = (address) =>
        (listeners.accountsChanged || []).forEach((fn) => fn([address]));
    },
    { address },
  );
  await page.route("https://rpc.bohr.life/**", async (route) => {
    const payload = route.request().postDataJSON();
    async function respond(p) {
      if (
        forceLegacy &&
        p.method === "eth_call" &&
        p.params[0]?.data?.startsWith(
          contract.interface.getFunction("WORKFLOW_VERSION").selector,
        )
      )
        return {
          jsonrpc: "2.0",
          id: p.id,
          error: { code: -32000, message: "execution reverted", data: "0x" },
        };
      try {
        return {
          jsonrpc: "2.0",
          id: p.id,
          result: await engine.request({
            method: p.method,
            params: p.params || [],
          }),
        };
      } catch (e) {
        return {
          jsonrpc: "2.0",
          id: p.id,
          error: { code: e.code || -32603, message: e.message, data: e.data },
        };
      }
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        Array.isArray(payload)
          ? await Promise.all(payload.map(respond))
          : await respond(payload),
      ),
    });
  });
  try {
    await page.goto("/#/register");
    for (const [label, value] of [
      ["Nama panggilan motor", "Motor EVM test"],
      ["Merek", "Honda"],
      ["Model", "Beat"],
      ["Tahun kendaraan", "2024"],
      ["Warna", "Merah"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Periksa pendaftaran" }).click();
    await page.getByRole("button", { name: "Konfirmasi pendaftaran" }).click();
    await expect(page.getByRole("heading", { name: "Honda Beat" })).toBeVisible(
      { timeout: 20000 },
    );
    await page
      .getByRole("link", { name: "Tambah catatan untuk motor ini" })
      .click();
    await page.getByLabel("Tanggal servis").fill("2026-09-20");
    await page.getByLabel("Pembacaan odometer (km)").fill("1500");
    await page
      .getByLabel("Keluhan atau kebutuhan servis")
      .fill("Perawatan pertama");
    await page
      .getByLabel("Pekerjaan yang dilakukan")
      .fill("Penggantian oli EVM");
    await page
      .getByRole("button", { name: "Periksa catatan", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Simpan catatan", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Penggantian oli EVM" }),
    ).toBeVisible();
    await page.getByText("Asal catatan & bukti", { exact: true }).click();
    await page.getByRole("button", { name: "Ambil bukti transaksi" }).click();
    await expect(
      page.getByRole("link", { name: "Bukti penyimpanan" }),
    ).toBeVisible({ timeout: 20000 });
    expect((await contract.getRecord(1)).status).toBe(1n);
    expect((await contract.getRecord(1)).issuer.toLowerCase()).toBe(
      accounts[0],
    );
    selected = accounts[1];
    await page.evaluate(
      (address) => window.testAccountChanged(address),
      selected,
    );
    await expect(
      page.getByText("Hanya dompet pemilik motor", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tambah catatan servis" }),
    ).toHaveCount(0);
    selected = accounts[0];
    await page.evaluate(
      (address) => window.testAccountChanged(address),
      selected,
    );
    forceLegacy = true;
    await page.reload();
    await expect(
      page.getByText("Paspor ini menggunakan kontrak lama", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tambah catatan servis" }),
    ).toHaveCount(0);
    const uploadsBefore = metadataUploads;
    await page.goto("/#/register");
    for (const [label, value] of [
      ["Nama panggilan motor", "Legacy"],
      ["Merek", "Honda"],
      ["Model", "Beat"],
      ["Tahun kendaraan", "2024"],
      ["Warna", "Hitam"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Periksa pendaftaran" }).click();
    await page.getByRole("button", { name: "Konfirmasi pendaftaran" }).click();
    await expect(page.getByRole("alert")).toContainText("versi lama");
    expect(metadataUploads).toBe(uploadsBefore);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await provider.destroy();
    await engine.disconnect();
  }
});
