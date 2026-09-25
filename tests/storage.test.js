import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Wallet } from "ethers";
import { createApp } from "../server/app.js";
import {
  digest,
  canonical,
  uploadMessage,
  validateMetadata,
} from "../src/lib/schema.js";
const data = {
  kind: "motor",
  name: "Test",
  brand: "Honda",
  model: "Vario",
  year: "2023",
  color: "Hitam",
  marker: "",
};
test("canonical data is order independent and detects tampering", () => {
  assert.equal(
    digest(data),
    digest(Object.fromEntries(Object.entries(data).reverse())),
  );
  assert.notEqual(digest(data), digest({ ...data, year: "2024" }));
  assert.throws(() => validateMetadata({ ...data, phone: "private" }));
  assert.throws(() => validateMetadata({ ...data, year: "3000" }));
  assert.throws(() =>
    validateMetadata({
      kind: "service",
      date: "2026-02-30",
      odometer: "3",
      complaint: "x",
      action: "y",
      parts: "",
    }),
  );
  assert.throws(() =>
    validateMetadata({
      kind: "service",
      date: "2026-01-01",
      odometer: "-3",
      complaint: "x",
      action: "y",
      parts: "",
    }),
  );
});
test("metadata requires signatures, rejects expired requests, and is public/read-only", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "motochain-test-"));
  const app = createApp({
    dataDir: dir,
    allowedOrigin: "https://moto.example",
    limit: 3,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const wallet = Wallet.createRandom(),
    timestamp = Date.now(),
    hash = digest(data);
  const signature = await wallet.signMessage(uploadMessage(hash, timestamp));
  const send = (payload) =>
    fetch(base + "/api/metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://moto.example",
      },
      body: JSON.stringify(payload),
    });
  try {
    assert.equal(
      (await send({ data, timestamp, signature: "invalid" })).status,
      400,
    );
    assert.equal(
      (await send({ data, timestamp: timestamp - 400000, signature })).status,
      400,
    );
    const response = await send({ data, timestamp, signature });
    assert.equal(response.status, 201);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://moto.example",
    );
    assert.equal((await response.json()).hash, hash);
    assert.equal(
      await (await fetch(base + "/api/metadata/" + hash)).text(),
      canonical(data),
    );
    assert.equal((await send({ data, timestamp, signature })).status, 201);
    assert.equal((await fetch(base + "/api/metadata/nope")).status, 400);
    assert.equal(
      (await fetch(base + "/api/metadata/" + "0x" + "0".repeat(64))).status,
      404,
    );
    assert.equal(
      (await fetch(base + "/api/metadata/" + hash, { method: "DELETE" }))
        .status,
      404,
    );
    await send({ data, timestamp, signature });
    assert.equal((await send({ data, timestamp, signature })).status, 429);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.security.close();
    await fs.rm(dir, { recursive: true });
  }
});
