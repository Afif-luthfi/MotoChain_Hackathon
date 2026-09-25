import { createProxyApp } from "./proxy.js";
import express from "express";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const app = createProxyApp({
  apiUrl: process.env.SUPABASE_API_URL || undefined,
});
app.use(express.static("dist"));
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "Motochain Service API: http://127.0.0.1:" + (process.env.PORT || 3001),
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
