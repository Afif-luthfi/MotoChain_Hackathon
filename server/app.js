import express from "express";
// Legacy disk-backed app used only by offline regression tests.
// Active runtime: index.js -> proxy.js -> Supabase Edge Function.
import fs from "node:fs/promises";
import path from "node:path";
import { verifyMessage } from "ethers";
import { createAiRouter } from "./ai.js";
import { openSecurity } from "./security.js";
import {
  digest,
  canonical,
  uploadMessage,
  validateMetadata,
} from "../src/lib/schema.js";

export function createApp({
  dataDir = "./data",
  allowedOrigin = "",
  limit = 30,
  ai = {},
  securityOptions = {},
} = {}) {
  const app = express();
  const security = openSecurity(dataDir, securityOptions);
  app.locals.security = security;
  const requests = new Map();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    if (allowedOrigin && req.get("Origin") === allowedOrigin) {
      res.set("Access-Control-Allow-Origin", allowedOrigin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use("/api/ai", createAiRouter({ ...ai, security }));
  app.use(express.json({ limit: "12kb" }));
  const authRate = new Map();
  app.use("/api/auth", (req, res, next) => {
    const now = Date.now();
    for (const [key, row] of authRate)
      if (row.until < now) authRate.delete(key);
    const row = authRate.get(req.ip) || { count: 0, until: now + 60000 };
    authRate.set(req.ip, row);
    if (++row.count > 20)
      return res
        .status(429)
        .json({ error: "Terlalu banyak permintaan masuk." });
    res.set("Cache-Control", "no-store");
    next();
  });
  app.post("/api/auth/challenge", (req, res) => {
    try {
      res.json(security.challenge(req.body?.wallet));
    } catch (e) {
      res
        .status(e.status || 503)
        .json({ error: e.status ? e.message : "Verifikasi tidak tersedia." });
    }
  });
  app.post("/api/auth/session", (req, res) => {
    try {
      if (
        typeof req.body?.nonce !== "string" ||
        typeof req.body?.signature !== "string"
      )
        return res.status(400).json({ error: "Permintaan masuk tidak valid." });
      res.json(security.login(req.body.nonce, req.body.signature));
    } catch (e) {
      res
        .status(e.status || 503)
        .json({ error: e.status ? e.message : "Verifikasi tidak tersedia." });
    }
  });
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", service: "Motochain Service" }),
  );
  app.post("/api/metadata", async (req, res) => {
    try {
      const now = Date.now();
      for (const [key, row] of requests)
        if (row.until < now) requests.delete(key);
      const ipKey = "ip:" + req.ip;
      const ipBucket = requests.get(ipKey) || { count: 0, until: now + 60000 };
      requests.set(ipKey, ipBucket);
      if (++ipBucket.count > limit * 4)
        return res.status(429).json({
          error: "Terlalu banyak permintaan. Coba kembali dalam satu menit.",
        });
      const { data, signature, timestamp } = req.body;
      validateMetadata(data);
      if (
        !Number.isSafeInteger(timestamp) ||
        Math.abs(Date.now() - timestamp) > 300000
      )
        throw new Error("Permintaan kedaluwarsa. Coba lagi.");
      const hash = digest(data);
      const signer = verifyMessage(uploadMessage(hash, timestamp), signature);
      const bucket = requests.get(signer) || { count: 0, until: now + 60000 };
      if (++bucket.count > limit)
        return res.status(429).json({
          error: "Terlalu banyak permintaan. Coba kembali dalam satu menit.",
        });
      requests.set(signer, bucket);
      security.storeMetadata(hash, canonical(data), signer);
      res.status(201).json({ hash, path: "/api/metadata/" + hash });
    } catch (error) {
      res.status(error.status || 400).json({
        error:
          error.code === "INVALID_ARGUMENT"
            ? "Tanda tangan tidak valid."
            : error.status || !error.code
              ? error.message
              : "Penyimpanan gagal. Hubungi pengelola.",
      });
    }
  });
  app.get("/api/metadata/:hash", async (req, res) => {
    if (!/^0x[a-f0-9]{64}$/.test(req.params.hash))
      return res.status(400).json({ error: "Identitas data tidak valid." });
    try {
      const raw = await fs.readFile(
        path.join(dataDir, req.params.hash + ".json"),
        "utf8",
      );
      res
        .set("Cache-Control", "public, max-age=31536000, immutable")
        .type("json")
        .send(raw);
    } catch {
      res
        .status(404)
        .json({ error: "Data belum tersedia. Hubungi pengelola paspor." });
    }
  });
  app.use((error, _req, res, _next) =>
    res
      .status(error.status || 500)
      .json({ error: "Permintaan tidak dapat diproses." }),
  );
  return app;
}
