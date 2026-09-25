import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Wallet } from "ethers";
import { openSecurity } from "../server/security.js";
import { createApp } from "../server/app.js";
import { deploymentConfig } from "../server/config.js";
import {
  createBackup,
  verifyBackup,
  restoreBackup,
} from "../scripts/backup.js";
import { digest, canonical } from "../src/lib/schema.js";
const motor = {
  kind: "motor",
  name: "Test",
  brand: "Honda",
  model: "Vario",
  year: "2023",
  color: "Hitam",
  marker: "",
};
test("metadata quota survives restart, deduplicates retries and caps total storage including legacy data", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "moto-quota-"));
  let security;
  try {
    security = openSecurity(dir, { walletUploadsPerDay: 1, maxFiles: 2 });
    security.storeMetadata(digest(motor), canonical(motor), "owner");
    security.storeMetadata(digest(motor), canonical(motor), "owner");
    security.close();
    security = openSecurity(dir, { walletUploadsPerDay: 1, maxFiles: 2 });
    const second = { ...motor, name: "Second" };
    assert.throws(
      () => security.storeMetadata(digest(second), canonical(second), "owner"),
      (e) => e.status === 429,
    );
    security.storeMetadata(digest(second), canonical(second), "other");
    const third = { ...motor, name: "Third" };
    assert.throws(
      () => security.storeMetadata(digest(third), canonical(third), "third"),
      (e) => e.status === 507,
    );
    security.close();
    security = openSecurity(dir, { maxBytes: 1 });
    assert.throws(
      () => security.storeMetadata(digest(third), canonical(third), "third"),
      (e) => e.status === 507,
    );
  } finally {
    security?.close();
    await fs.rm(dir, { recursive: true });
  }
});
test("signed AI login is allowlisted, single use, expiring; spending remains capped after server restart", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "moto-auth-"));
  const wallet = Wallet.createRandom(),
    stranger = Wallet.createRandom();
  let app,
    server,
    base,
    calls = 0;
  const start = async () => {
    app = createApp({
      dataDir: dir,
      securityOptions: {
        allowedWallets: wallet.address,
        publicUrl: "https://moto.example",
      },
      ai: {
        apiKey: "test-key",
        allowRemote: true,
        dailyLimit: 1,
        walletDailyLimit: 1,
        fetchImpl: async () => {
          calls++;
          return { ok: false, status: 503, json: async () => ({}) };
        },
      },
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = "http://127.0.0.1:" + server.address().port;
  };
  const stop = async () => {
    await new Promise((r) => server.close(r));
    app.locals.security.close();
  };
  const post = (route, body, token) =>
    fetch(base + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    await start();
    assert.equal(
      (await post("/api/ai/receipt", { text: "nota", consent: true })).status,
      401,
    );
    assert.equal(
      (await post("/api/auth/challenge", { wallet: stranger.address })).status,
      403,
    );
    const challenge = await (
      await post("/api/auth/challenge", { wallet: wallet.address })
    ).json();
    assert.match(challenge.message, /https:\/\/moto.example/);
    assert.equal(
      (
        await post("/api/auth/session", {
          nonce: challenge.nonce,
          signature: await stranger.signMessage(challenge.message),
        })
      ).status,
      401,
    );
    const login = {
      nonce: challenge.nonce,
      signature: await wallet.signMessage(challenge.message),
    };
    const session = await (await post("/api/auth/session", login)).json();
    assert.ok(session.token);
    assert.equal((await post("/api/auth/session", login)).status, 401);
    assert.equal(
      (
        await post(
          "/api/ai/receipt",
          { text: "nota", consent: true },
          session.token,
        )
      ).status,
      502,
    );
    await stop();
    await start();
    assert.equal(
      (
        await post(
          "/api/ai/receipt",
          { text: "nota", consent: true },
          session.token,
        )
      ).status,
      429,
    );
    assert.equal(calls, 1);
    app.locals.security.db.exec("UPDATE sessions SET expires=0");
    assert.equal(
      (
        await post(
          "/api/ai/receipt",
          { text: "nota", consent: true },
          session.token,
        )
      ).status,
      401,
    );
  } finally {
    await stop();
    await fs.rm(dir, { recursive: true });
  }
});
test("verified backup restores metadata and quotas, invalidates sessions, detects corrupted files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "moto-backup-"));
  const source = path.join(root, "source"),
    dest = path.join(root, "restored");
  let store = openSecurity(source, { walletUploadsPerDay: 1 });
  try {
    store.storeMetadata(digest(motor), canonical(motor), "owner");
    store.ai("owner", 1);
    const snapshot = await createBackup(source, path.join(root, "backups"));
    await restoreBackup(snapshot, dest);
    const restored = openSecurity(dest);
    try {
      assert.equal(
        await fs.readFile(path.join(dest, digest(motor) + ".json"), "utf8"),
        canonical(motor),
      );
      assert.throws(
        () => restored.ai("owner", 1),
        (e) => e.status === 429,
      );
      assert.equal(
        restored.db.prepare("SELECT COUNT(*) AS count FROM sessions").get()
          .count,
        0,
      );
    } finally {
      restored.close();
    }
    await fs.writeFile(path.join(snapshot, digest(motor) + ".json"), "{}");
    await assert.rejects(verifyBackup(snapshot), /checksum/);
    await assert.rejects(createBackup(source, source), /outside/);
  } finally {
    store.close();
    await fs.rm(root, { recursive: true });
  }
});
test("production refuses ephemeral relative storage, HTTP origin and unrestricted public AI", () => {
  assert.throws(
    () => deploymentConfig({ NODE_ENV: "production", DATA_DIR: "./data" }),
    /absolute/,
  );
  const base = {
    NODE_ENV: "production",
    DATA_DIR: path.resolve("data"),
    PUBLIC_URL: "http://example.com",
  };
  assert.throws(() => deploymentConfig(base), /https/);
  assert.throws(
    () =>
      deploymentConfig({
        ...base,
        PUBLIC_URL: "https://example.com",
        AI_ALLOW_REMOTE: "true",
      }),
    /AI_ALLOWED_WALLETS/,
  );
  assert.equal(
    deploymentConfig({ ...base, PUBLIC_URL: "https://example.com" })
      .allowedOrigin,
    "https://example.com",
  );
});
