import { createApp } from "./app.js";
import express from "express";
import { existsSync } from "node:fs";
import { deploymentConfig } from "./config.js";
if (existsSync(".env")) process.loadEnvFile(".env");
const app = createApp(deploymentConfig());
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
      app.locals.security.close();
      process.exit(0);
    });
  });
