import express from "express";
import { validateReceipt, extractReceipt } from "./receipt.js";
export { validateReceipt, parseDraft, extractReceipt } from "./receipt.js";
const fail = (status, message) => Object.assign(new Error(message), { status });
export function createAiRouter({
  apiKey = process.env.GEMINI_API_KEY || "",
  model = process.env.GEMINI_MODEL || "gemini-3.5-flash",
  allowRemote = process.env.AI_ALLOW_REMOTE === "true",
  dailyLimit = Number(process.env.AI_DAILY_LIMIT || 50),
  fetchImpl = fetch,
  security,
  walletDailyLimit = Number(process.env.AI_WALLET_DAILY_LIMIT || 10),
} = {}) {
  const router = express.Router();
  const limits = new Map();
  let active = 0;
  const maximum =
    Number.isFinite(dailyLimit) && dailyLimit >= 1
      ? Math.min(Math.floor(dailyLimit), 1000)
      : 50;
  const localNames = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/status", (_req, res) =>
    res.json({
      configured: !!apiKey,
      provider: "Gemini",
      model,
      localOnly: !allowRemote,
      requiresAuth: allowRemote,
    }),
  );
  router.post(
    "/receipt",
    (req, res, next) => {
      if (!apiKey)
        return res.status(503).json({
          error:
            "AI belum aktif. Pengelola perlu mengisi GEMINI_API_KEY di server.",
        });
      const origin = req.get("Origin");
      let localOrigin = true;
      try {
        if (origin) localOrigin = localNames.has(new URL(origin).hostname);
      } catch {
        localOrigin = false;
      }
      const localSocket = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress,
      );
      if (
        !allowRemote &&
        !(localSocket && localNames.has(req.hostname) && localOrigin)
      )
        return res.status(403).json({
          error:
            "AI saat ini hanya diaktifkan untuk akses dari komputer server.",
        });
      const now = Date.now();
      for (const [key, row] of limits) if (row.until <= now) limits.delete(key);
      const bucket = limits.get(req.ip) || { count: 0, until: now + 60000 };
      limits.set(req.ip, bucket);
      if (++bucket.count > 5)
        return res.status(429).json({
          error: "Maksimal lima pembacaan nota per menit. Tunggu sebentar.",
        });
      if (allowRemote) {
        try {
          req.aiWallet = security.authenticate(req);
        } catch (e) {
          return res.status(e.status || 503).json({
            error: e.status ? e.message : "Verifikasi AI tidak tersedia.",
          });
        }
      }
      next();
    },
    express.json({ limit: "7mb" }),
    async (req, res) => {
      let counted = false;
      try {
        const input = validateReceipt(req.body);
        const wallet = allowRemote ? req.aiWallet : "local";
        if (active >= 2)
          throw fail(429, "AI sedang membaca nota lain. Coba lagi sebentar.");
        active++;
        counted = true;
        security.ai(
          wallet,
          maximum,
          Number.isSafeInteger(walletDailyLimit) && walletDailyLimit > 0
            ? walletDailyLimit
            : 10,
        );
        const result = await extractReceipt(input, {
          apiKey,
          model,
          fetchImpl,
        });
        res.json({ ...result, provider: "Gemini", model });
      } catch (error) {
        res.status(error.status || 500).json({
          error: error.status
            ? error.message
            : "Pembacaan nota gagal. Isian manual tetap tersedia.",
        });
      } finally {
        if (counted) active--;
      }
    },
  );
  router.use((error, _req, res, _next) =>
    res.status(error.status === 413 ? 413 : 400).json({
      error:
        error.status === 413
          ? "Foto terlalu besar. Gunakan berkas maksimal 5 MB."
          : "Permintaan AI tidak valid.",
    }),
  );
  return router;
}
