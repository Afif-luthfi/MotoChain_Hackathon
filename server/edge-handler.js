import { verifyMessage } from "ethers";
import {
  canonical,
  digest,
  uploadMessage,
  validateMetadata,
} from "../src/lib/schema.js";
import { validateReceipt, extractReceipt } from "./receipt.js";
import { fail } from "./supabase-store.js";

// Public metadata is intentionally readable from any origin.
// CORS is not authentication: writes require a wallet signature; AI requires a session.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
};
async function readJson(request, maximum) {
  if (Number(request.headers.get("content-length")) > maximum)
    throw fail(413, "Permintaan terlalu besar.");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw fail(415, "Gunakan format JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw fail(400, "Permintaan tidak valid.");
  let length = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw fail(413, "Permintaan terlalu besar.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw fail(400, "Permintaan JSON tidak valid.");
  }
}

export function createEdgeHandler({
  store,
  publicApiUrl,
  apiKey = "",
  model = "gemini-3.5-flash",
  dailyLimit = 50,
  walletDailyLimit = 10,
  fetchImpl = fetch,
}) {
  let active = 0;
  const limits = new Map();
  function rate(scope, maximum) {
    const now = Date.now();
    for (const [key, value] of limits)
      if (value.until <= now) limits.delete(key);
    const bucket = limits.get(scope) || { count: 0, until: now + 60000 };
    limits.set(scope, bucket);
    if (++bucket.count > maximum)
      throw fail(
        429,
        "Terlalu banyak permintaan. Coba kembali dalam satu menit.",
      );
  }
  return async function handle(request) {
    const json = (data, status = 200) =>
      Response.json(data, {
        status,
        headers: { ...cors, "Cache-Control": "no-store" },
      });
    try {
      const pathname = new URL(request.url).pathname;
      const route = pathname.startsWith("/functions/v1/motochain-api")
        ? pathname.slice("/functions/v1/motochain-api".length)
        : pathname.startsWith("/motochain-api")
          ? pathname.slice("/motochain-api".length)
          : pathname;
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: cors });
      if (request.method === "GET" && route === "/api/health")
        return json({
          status: "ok",
          service: "Motochain Service",
          ...(await store.health()),
        });
      if (request.method === "GET" && route === "/api/ai/status")
        return json({
          configured: !!apiKey,
          provider: "Gemini",
          model,
          localOnly: false,
          requiresAuth: true,
        });
      if (request.method === "GET" && route.startsWith("/api/metadata/")) {
        const hash = route.slice("/api/metadata/".length);
        if (!/^0x[a-f0-9]{64}$/.test(hash))
          throw fail(400, "Identitas data tidak valid.");
        const raw = await store.readMetadata(hash);
        if (raw === null)
          throw fail(404, "Data belum tersedia. Hubungi pengelola paspor.");
        return new Response(raw, {
          headers: {
            ...cors,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
      if (request.method !== "POST")
        return json({ error: "Endpoint tidak ditemukan." }, 404);
      if (route === "/api/metadata") {
        const { data, timestamp, signature } = await readJson(
          request,
          12 * 1024,
        );
        try {
          validateMetadata(data);
        } catch (error) {
          throw fail(400, error.message);
        }
        if (
          !Number.isSafeInteger(timestamp) ||
          Math.abs(Date.now() - timestamp) > 300000
        )
          throw fail(400, "Permintaan kedaluwarsa. Coba lagi.");
        const hash = digest(data);
        let signer;
        try {
          signer = verifyMessage(
            uploadMessage(hash, timestamp),
            signature,
          ).toLowerCase();
        } catch {
          throw fail(400, "Tanda tangan tidak valid.");
        }
        rate("metadata:" + signer, 30);
        await store.storeMetadata(hash, canonical(data), signer);
        // A stable HTTPS URI is saved on-chain even when the website runs on localhost.
        return json(
          { hash, path: publicApiUrl + "/api/metadata/" + hash },
          201,
        );
      }
      if (route === "/api/auth/challenge") {
        const body = await readJson(request, 4096);
        return json(await store.challenge(body?.wallet));
      }
      if (route === "/api/auth/session") {
        const body = await readJson(request, 4096);
        return json(await store.login(body?.nonce, body?.signature));
      }
      if (route === "/api/ai/receipt") {
        const wallet = await store.authenticate(
          request.headers.get("Authorization"),
        );
        if (!apiKey)
          throw fail(
            503,
            "AI belum aktif. Pengelola perlu mengisi GEMINI_API_KEY di Supabase.",
          );
        rate("ai:" + wallet, 5);
        const input = validateReceipt(await readJson(request, 7 * 1024 * 1024));
        if (active >= 2)
          throw fail(429, "AI sedang membaca nota lain. Coba lagi sebentar.");
        active++;
        try {
          await store.ai(wallet, dailyLimit, walletDailyLimit);
          return json({
            ...(await extractReceipt(input, { apiKey, model, fetchImpl })),
            provider: "Gemini",
            model,
          });
        } finally {
          active--;
        }
      }
      return json({ error: "Endpoint tidak ditemukan." }, 404);
    } catch (error) {
      return json(
        {
          error: error.status
            ? error.message
            : "Layanan belum tersedia. Coba kembali.",
        },
        error.status || 503,
      );
    }
  };
}
