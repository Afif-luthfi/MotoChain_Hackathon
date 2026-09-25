// Offline EVM/browser fixtures use isolated legacy storage, never the cloud project.
import { createApp } from "../../server/app.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const directory = await mkdtemp(path.join(tmpdir(), "motochain-browser-"));
const app = createApp({ dataDir: directory, ai: { apiKey: "" } });
const server = app.listen(3002, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(async () => {
      app.locals.security.close();
      await rm(directory, { recursive: true, force: true });
      process.exit(0);
    });
  });
