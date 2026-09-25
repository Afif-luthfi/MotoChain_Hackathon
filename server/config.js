import path from "node:path";
export function deploymentConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const dataDir = env.DATA_DIR || "./data";
  const publicUrl = env.PUBLIC_URL || "";
  if (production) {
    if (!path.isAbsolute(dataDir))
      throw Error("Production requires an absolute persistent DATA_DIR.");
    const url = new URL(publicUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      throw Error(
        "Production requires PUBLIC_URL=https://your-public-domain (origin only).",
      );
    if (env.AI_ALLOW_REMOTE === "true" && !env.AI_ALLOWED_WALLETS?.trim())
      throw Error("Public AI requires AI_ALLOWED_WALLETS.");
  }
  const number = (key, fallback) => {
    const value = Number(env[key] || fallback);
    if (!Number.isSafeInteger(value) || value < 1)
      throw Error(key + " must be a positive integer.");
    return value;
  };
  return {
    dataDir,
    allowedOrigin: env.ALLOWED_ORIGIN || publicUrl,
    securityOptions: {
      publicUrl,
      allowedWallets: env.AI_ALLOWED_WALLETS || "",
      maxBytes: number("METADATA_MAX_BYTES", 104857600),
      maxFiles: number("METADATA_MAX_FILES", 10000),
      uploadsPerDay: number("METADATA_DAILY_LIMIT", 500),
      walletUploadsPerDay: number("METADATA_WALLET_DAILY_LIMIT", 20),
    },
  };
}
