import { randomBytes, createHash } from "node:crypto";
import { isAddress, verifyMessage } from "ethers";

export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function createSupabaseStore({
  url,
  key,
  options = {},
  fetchImpl = fetch,
}) {
  if (!url || !key) throw Error("Supabase backend credentials are missing.");
  const allowed = new Set(
    (options.allowedWallets || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const wallet of allowed)
    if (!isAddress(wallet))
      throw Error("AI_ALLOWED_WALLETS contains an invalid address.");
  const allowedWallet = (wallet) => {
    if (options.allowAllWallets !== true && !allowed.has(wallet.toLowerCase()))
      throw fail(
        403,
        "Dompet belum mendapat akses AI. Hubungi pengelola aplikasi.",
      );
  };
  async function rpc(operation, args = {}) {
    let response;
    try {
      response = await fetchImpl(
        url.replace(/\/$/, "") + "/rest/v1/rpc/motochain_backend",
        {
          method: "POST",
          headers: {
            apikey: key,
            ...(key.startsWith("eyJ")
              ? { Authorization: "Bearer " + key }
              : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_operation: operation, p_args: args }),
          signal: AbortSignal.timeout(12000),
        },
      );
    } catch {
      throw fail(503, "Database belum dapat dihubungi. Coba kembali.");
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const statuses = { PT401: 401, PT409: 409, PT429: 429, PT507: 507 };
      if (statuses[result?.code])
        throw fail(statuses[result.code], result.message);
      throw fail(
        503,
        "Penyimpanan Supabase belum tersedia. Hubungi pengelola.",
      );
    }
    return result;
  }
  return {
    health: () => rpc("health"),
    readMetadata: (hash) => rpc("read", { hash }),
    storeMetadata: (hash, raw, wallet) =>
      rpc("store", {
        hash,
        raw,
        wallet: wallet.toLowerCase(),
        maxBytes: options.maxBytes ?? 104857600,
        maxFiles: options.maxFiles ?? 10000,
        uploadsPerDay: options.uploadsPerDay ?? 500,
        walletUploadsPerDay: options.walletUploadsPerDay ?? 20,
      }),
    async challenge(wallet) {
      if (typeof wallet !== "string" || !isAddress(wallet))
        throw fail(400, "Alamat dompet tidak valid.");
      wallet = wallet.toLowerCase();
      allowedWallet(wallet);
      const nonce = randomBytes(24).toString("hex");
      const message = [
        "Motochain Service",
        "Authorize receipt AI access",
        "Site: " + options.publicUrl,
        "Wallet: " + wallet,
        "Nonce: " + nonce,
        "Expires: " + new Date(Date.now() + 300000).toISOString(),
        "No blockchain transaction or token transfer.",
      ].join("\n");
      await rpc("challenge", { nonce, wallet, message });
      return { nonce, message };
    },
    async login(nonce, signature) {
      if (
        typeof nonce !== "string" ||
        !/^[a-f0-9]{48}$/.test(nonce) ||
        typeof signature !== "string"
      )
        throw fail(400, "Permintaan masuk tidak valid.");
      const row = await rpc("get_challenge", { nonce });
      if (!row)
        throw fail(401, "Permintaan masuk kedaluwarsa atau sudah dipakai.");
      let wallet;
      try {
        wallet = verifyMessage(row.message, signature).toLowerCase();
      } catch {
        throw fail(401, "Tanda tangan tidak valid.");
      }
      if (wallet !== row.wallet)
        throw fail(401, "Dompet penanda tangan tidak sesuai.");
      allowedWallet(wallet);
      const token = randomBytes(32).toString("hex");
      const result = await rpc("login", {
        nonce,
        wallet,
        token: hashToken(token),
      });
      return { token, expires: result.expires };
    },
    async authenticate(authorization) {
      const token = (authorization || "").replace(/^Bearer /, "");
      if (!/^[a-f0-9]{64}$/.test(token))
        throw fail(
          401,
          "Hubungkan dan verifikasi dompet untuk menggunakan AI.",
        );
      const row = await rpc("session", { token: hashToken(token) });
      if (!row)
        throw fail(401, "Sesi AI kedaluwarsa. Verifikasi dompet kembali.");
      allowedWallet(row.wallet);
      return row.wallet;
    },
    ai: (wallet, maximum, perWallet) =>
      rpc("ai", { wallet, maximum, perWallet }),
  };
}
