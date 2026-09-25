import { test } from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { createHash } from "node:crypto";
import { createEdgeHandler } from "../server/edge-handler.js";
import { createSupabaseStore } from "../server/supabase-store.js";
import { canonical, digest, uploadMessage } from "../src/lib/schema.js";
import { createProxyApp } from "../server/proxy.js";

const data = {
  kind: "motor",
  name: "Integration test",
  brand: "Honda",
  model: "Beat",
  year: "2024",
  color: "Merah",
  marker: "",
};
const base = "https://example.supabase.co/functions/v1/motochain-api";
const post = (path, body, headers = {}) =>
  new Request(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("Edge validates signatures and fields before cloud writes; returns a permanent HTTPS URI", async () => {
  const rows = new Map();
  let writes = 0;
  const handle = createEdgeHandler({
    publicApiUrl: base,
    store: {
      storeMetadata: async (hash, raw) => {
        writes++;
        rows.set(hash, raw);
      },
      readMetadata: async (hash) => rows.get(hash) ?? null,
    },
  });
  const wallet = Wallet.createRandom(),
    timestamp = Date.now(),
    hash = digest(data);
  const signature = await wallet.signMessage(uploadMessage(hash, timestamp));
  for (const invalid of [
    { data, timestamp, signature: "invalid" },
    { data, timestamp: timestamp - 400000, signature },
    { data: { ...data, image: "private receipt" }, timestamp, signature },
    { data: { ...data, name: "tampered" }, timestamp, signature: "invalid" },
  ])
    assert.equal((await handle(post("/api/metadata", invalid))).status, 400);
  assert.equal(writes, 0);
  const response = await handle(
    post("/api/metadata", { data, timestamp, signature }),
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    hash,
    path: base + "/api/metadata/" + hash,
  });
  const read = await handle(new Request(base + "/api/metadata/" + hash));
  assert.equal(await read.text(), canonical(data));
  assert.equal(read.headers.get("access-control-allow-origin"), "*");
  assert.match(read.headers.get("cache-control"), /immutable/);
  assert.equal(
    (await handle(new Request(base + "/api/metadata/" + "0x" + "0".repeat(64))))
      .status,
    404,
  );
  assert.equal(
    (
      await handle(
        new Request(base + "/api/metadata/" + hash, { method: "DELETE" }),
      )
    ).status,
    404,
  );
});

test("Edge rejects oversized chunked JSON and sanitizes database failures", async () => {
  const handle = createEdgeHandler({
    publicApiUrl: base,
    store: {
      health: async () => {
        throw Error("secret database password");
      },
    },
  });
  assert.equal(
    (await handle(post("/api/metadata", { value: "a".repeat(13000) }))).status,
    413,
  );
  const response = await handle(new Request(base + "/api/health"));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("password"));
  assert.equal(
    (await handle(new Request(base + "/api/metadata", { method: "OPTIONS" })))
      .status,
    204,
  );
});

for (const allowAllWallets of [false, true]) test(`Supabase sessions verify signers, hash tokens and reject replay (all wallets: ${allowAllWallets})`, async () => {
  const wallet = Wallet.createRandom(),
    stranger = Wallet.createRandom();
  const challenges = new Map(),
    sessions = new Map();
  const calls = [];
  const store = createSupabaseStore({
    url: "https://example.supabase.co",
    key: "server-test-key",
    options: {
      allowedWallets: allowAllWallets ? "" : wallet.address,
      allowAllWallets,
      publicUrl: "https://moto.example",
    },
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.apikey, "server-test-key");
      const { p_operation: op, p_args: args } = JSON.parse(options.body);
      calls.push({ op, args });
      if (op === "challenge") {
        challenges.set(args.nonce, args);
        return Response.json({});
      }
      if (op === "get_challenge")
        return Response.json(challenges.get(args.nonce) || null);
      if (op === "login") {
        if (!challenges.delete(args.nonce))
          return Response.json(
            { code: "PT401", message: "Replay" },
            { status: 401 },
          );
        const row = { ...args, expires: Date.now() + 3600000 };
        sessions.set(args.token, row);
        return Response.json({ expires: row.expires });
      }
      if (op === "session")
        return Response.json(sessions.get(args.token) || null);
      throw Error(op);
    },
  });
  if (!allowAllWallets) await assert.rejects(
    store.challenge(stranger.address),
    (e) => e.status === 403,
  );
  await assert.rejects(store.challenge("invalid"), (e) => e.status === 400);
  const challenge = await store.challenge(wallet.address);
  assert.match(challenge.message, /https:\/\/moto.example/);
  await assert.rejects(
    store.login(challenge.nonce, await stranger.signMessage(challenge.message)),
    (e) => e.status === 401,
  );
  const signature = await wallet.signMessage(challenge.message);
  const results = await Promise.allSettled([
    store.login(challenge.nonce, signature),
    store.login(challenge.nonce, signature),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const session = results.find((r) => r.status === "fulfilled").value;
  assert.equal(
    await store.authenticate("Bearer " + session.token),
    wallet.address.toLowerCase(),
  );
  const hashed = createHash("sha256").update(session.token).digest("hex");
  assert.ok(sessions.has(hashed));
  assert.ok(!JSON.stringify(calls).includes(session.token));
  sessions.clear();
  await assert.rejects(
    store.authenticate("Bearer " + session.token),
    (e) => e.status === 401,
  );
});

test("AI requires authentication and consent, reserves quota before provider, persists no receipt source", async () => {
  const calls = [];
  const handle = createEdgeHandler({
    publicApiUrl: base,
    apiKey: "test-key",
    store: {
      authenticate: async (value) => {
        if (value !== "Bearer session")
          throw Object.assign(Error("Unauthorized"), { status: 401 });
        return "owner";
      },
      ai: async (...args) => {
        calls.push(args);
      },
    },
    fetchImpl: async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    date: "2026-09-20",
                    odometer: "12500",
                    complaint: "",
                    action: "Ganti oli",
                    parts: "Oli",
                    warnings: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
  });
  const headers = { Authorization: "Bearer session" };
  assert.equal(
    (await handle(post("/api/ai/receipt", { text: "source", consent: true })))
      .status,
    401,
  );
  assert.equal(
    (await handle(post("/api/ai/receipt", { text: "source" }, headers))).status,
    400,
  );
  assert.equal(calls.length, 0);
  const result = await handle(
    post("/api/ai/receipt", { text: "source", consent: true }, headers),
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).draft.action, "Ganti oli");
  assert.deepEqual(calls, [["owner", 50, 10]]);
});

test("local server relays API to Supabase without filesystem storage or leaking upstream errors", async () => {
  const calls = [];
  const app = createProxyApp({
    apiUrl: base,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ status: "ok", storage: "supabase" });
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const response = await fetch(
      "http://127.0.0.1:" + server.address().port + "/api/health",
    );
    assert.equal((await response.json()).storage, "supabase");
    assert.equal(calls[0].url, base + "/api/health");
    assert.equal(app.locals.security, undefined);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
