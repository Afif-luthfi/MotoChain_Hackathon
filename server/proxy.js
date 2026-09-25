import express from "express";
import { DEFAULT_API_URL } from "../src/lib/api-config.js";

export function createProxyApp({
  apiUrl = DEFAULT_API_URL,
  fetchImpl = fetch,
} = {}) {
  const upstream = new URL(apiUrl);
  if (
    upstream.protocol !== "https:" ||
    upstream.username ||
    upstream.password ||
    upstream.search ||
    upstream.hash
  )
    throw Error("SUPABASE_API_URL must be a public HTTPS API base URL.");
  const base = upstream.href.replace(/\/$/, "");
  const app = express();
  app.disable("x-powered-by");
  app.use(
    "/api",
    express.raw({ type: () => true, limit: "7mb" }),
    async (req, res) => {
      if (!["GET", "POST", "OPTIONS"].includes(req.method))
        return res.status(405).json({ error: "Metode tidak didukung." });
      try {
        const headers = {};
        for (const name of ["content-type", "authorization", "origin"])
          if (req.get(name)) headers[name] = req.get(name);
        const response = await fetchImpl(base + req.originalUrl, {
          method: req.method,
          headers,
          redirect: "error",
          ...(req.method === "POST" ? { body: req.body } : {}),
          signal: AbortSignal.timeout(55000),
        });
        for (const name of [
          "content-type",
          "cache-control",
          "access-control-allow-origin",
          "access-control-allow-headers",
          "access-control-allow-methods",
          "x-content-type-options",
        ])
          if (response.headers.has(name))
            res.set(name, response.headers.get(name));
        res
          .status(response.status)
          .send(Buffer.from(await response.arrayBuffer()));
      } catch {
        res
          .status(503)
          .json({
            error: "Backend Supabase belum dapat dihubungi. Coba kembali.",
          });
      }
    },
  );
  app.use((error, _req, res, _next) =>
    res
      .status(error.status === 413 ? 413 : 400)
      .json({ error: "Permintaan tidak valid atau terlalu besar." }),
  );
  return app;
}
