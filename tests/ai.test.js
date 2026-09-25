import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
import { extractReceipt, parseDraft, validateReceipt } from "../server/ai.js";

const draft = {
  date: "2026-09-20",
  odometer: "12500",
  complaint: "",
  action: "Penggantian oli mesin",
  parts: "Oli mesin",
  warnings: ["Keluhan tidak tercantum."],
};
const answer = (value) => ({
  ok: true,
  json: async () => ({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  }),
});
async function withServer(ai, run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "motochain-ai-"));
  const app = createApp({ ai, dataDir: dir });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.security.close();
    await fs.rm(dir, { recursive: true });
  }
}
test("receipt validation requires consent and bounded supported content", () => {
  assert.throws(() => validateReceipt({ text: "nota" }), /Setujui/);
  assert.throws(
    () => validateReceipt({ text: "", consent: true }),
    /Tambahkan/,
  );
  assert.throws(
    () => validateReceipt({ text: "x".repeat(6001), consent: true }),
    /6.000/,
  );
  assert.throws(
    () =>
      validateReceipt({
        consent: true,
        image: { mimeType: "application/pdf", data: "AAAA" },
      }),
    /JPG/,
  );
  assert.throws(
    () =>
      validateReceipt({
        consent: true,
        image: { mimeType: "image/png", data: "AAAA" },
      }),
    /format/,
  );
  assert.equal(
    validateReceipt({ text: "  Ganti oli  ", consent: true }).text,
    "Ganti oli",
  );
});
test("AI draft rejects invalid structure and clears guessed numeric/date values", () => {
  assert.throws(() => parseDraft({ date: "2026-09-20" }));
  const parsed = parseDraft({
    ...draft,
    date: "2099-01-01",
    odometer: "12.500 km",
  });
  assert.equal(parsed.draft.date, "");
  assert.equal(parsed.draft.odometer, "");
  assert.ok(parsed.missing.includes("complaint"));
  assert.ok(parsed.warnings.length > 1);
  assert.equal(parsed.draft.action, draft.action);
});
test("Gemini request uses server-only header, structured output and no tools", async () => {
  let request;
  const result = await extractReceipt(
    { text: "20 September 2026, ganti oli 12500 km." },
    {
      apiKey: "secret-test-key",
      model: "gemini-test",
      fetchImpl: async (url, options) => {
        request = { url, options };
        return answer(draft);
      },
    },
  );
  assert.equal(request.options.headers["x-goog-api-key"], "secret-test-key");
  assert.ok(!request.url.includes("secret-test-key"));
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.ok(body.systemInstruction.parts[0].text.includes("untrusted data"));
  assert.equal(body.tools, undefined);
  assert.equal(result.draft.action, draft.action);
  assert.ok(!JSON.stringify(result).includes("secret-test-key"));
});
test("upstream errors and blocked/incomplete generations never leak key or raw response", async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 502, 503, 504]) {
    await assert.rejects(
      extractReceipt(
        { text: "nota" },
        {
          apiKey: "hidden-key",
          model: "test",
          fetchImpl: async () => ({
            ok: false,
            status,
            json: async () => ({ secret: "hidden-key" }),
          }),
        },
      ),
      (e) => !e.message.includes("hidden-key") && [429, 502].includes(e.status),
    );
  }
  await assert.rejects(
    extractReceipt(
      { text: "nota" },
      {
        apiKey: "k",
        model: "m",
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            candidates: [
              {
                finishReason: "MAX_TOKENS",
                content: { parts: [{ text: "{}" }] },
              },
            ],
          }),
        }),
      },
    ),
    /lengkap/,
  );
});
test("AI endpoint disabled without key; no external call occurs", async () => {
  let calls = 0;
  await withServer(
    {
      apiKey: "",
      fetchImpl: async () => {
        calls++;
      },
    },
    async (base) => {
      assert.equal(
        (await (await fetch(base + "/api/ai/status")).json()).configured,
        false,
      );
      const response = await fetch(base + "/api/ai/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "nota", consent: true }),
      });
      assert.equal(response.status, 503);
      assert.equal(calls, 0);
    },
  );
});
test("AI route returns reviewed draft shape, rejects foreign origins and caps spending", async () => {
  let calls = 0;
  await withServer(
    {
      apiKey: "hidden-key",
      model: "test",
      dailyLimit: 1,
      fetchImpl: async () => {
        calls++;
        return answer(draft);
      },
    },
    async (base) => {
      const send = (body, origin) =>
        fetch(base + "/api/ai/receipt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(origin ? { Origin: origin } : {}),
          },
          body: JSON.stringify(body),
        });
      assert.equal(
        (await send({ text: "nota", consent: true }, "https://foreign.example"))
          .status,
        403,
      );
      assert.equal((await send({ text: "nota" })).status, 400);
      const response = await send({ text: "nota", consent: true });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.provider, "Gemini");
      assert.equal(data.draft.complaint, "");
      assert.equal(data.draft.action, draft.action);
      assert.ok(!JSON.stringify(data).includes("hidden-key"));
      assert.equal((await send({ text: "nota", consent: true })).status, 429);
      assert.equal(calls, 1);
    },
  );
});
