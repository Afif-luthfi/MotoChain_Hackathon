import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMetadata } from "../src/lib/metadata.js";
import { canonical, digest } from "../src/lib/schema.js";
const data = {
  kind: "motor",
  name: "Migration",
  brand: "Yamaha",
  model: "Aerox",
  year: "2024",
  color: "Hitam",
  marker: "",
};
const base = "https://example.supabase.co/functions/v1/motochain-api";
test("migrated localhost metadata loads by its blockchain digest from Supabase first", async () => {
  const urls = [];
  const result = await loadMetadata(
    "http://127.0.0.1:3001/api/metadata/" + digest(data),
    digest(data),
    base,
    async (url) => {
      urls.push(url);
      return new Response(canonical(data));
    },
  );
  assert.equal(result.integrity, true);
  assert.deepEqual(urls, [base + "/api/metadata/" + digest(data)]);
});
test("unavailable historical HTTPS source falls back but a mismatching hash is never accepted", async () => {
  let calls = 0;
  const result = await loadMetadata(
    "https://old.example/metadata",
    digest(data),
    base,
    async () =>
      ++calls === 1
        ? new Response("", { status: 404 })
        : new Response(canonical(data)),
  );
  assert.equal(result.integrity, true);
  assert.equal(calls, 2);
  calls = 0;
  const corrupt = await loadMetadata(
    "https://old.example/metadata",
    digest(data),
    base,
    async () => {
      calls++;
      return new Response(canonical({ ...data, name: "Tampered" }));
    },
  );
  assert.equal(corrupt.integrity, false);
  assert.equal(calls, 1);
});
