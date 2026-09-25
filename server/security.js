import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { verifyMessage, isAddress } from "ethers";

export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
export function openSecurity(dataDir, options = {}) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "security.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;",
  );
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (scope TEXT, period TEXT, count INTEGER NOT NULL, PRIMARY KEY(scope,period));
    CREATE TABLE IF NOT EXISTS challenges (nonce TEXT PRIMARY KEY, wallet TEXT, message TEXT, expires INTEGER);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, wallet TEXT, expires INTEGER);
    CREATE TABLE IF NOT EXISTS metadata (hash TEXT PRIMARY KEY, bytes INTEGER NOT NULL);
  `);
  // Reconcile files written before quotas existed, or before a transaction crashed.
  for (const name of readdirSync(dataDir)) {
    if (/^0x[a-f0-9]{64}\.json$/.test(name)) {
      const raw = readFileSync(path.join(dataDir, name));
      db.prepare("INSERT OR IGNORE INTO metadata VALUES (?, ?)").run(
        name.slice(0, -5),
        raw.length,
      );
    }
  }
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  function reserve(entries) {
    for (const [scope, period, maximum] of entries) {
      const row = db
        .prepare("SELECT count FROM usage WHERE scope=? AND period=?")
        .get(scope, period);
      if ((row?.count || 0) >= maximum)
        throw fail(
          429,
          "Kuota penggunaan tercapai. Coba lagi setelah periode kuota berakhir.",
        );
    }
    for (const [scope, period] of entries)
      db.prepare(
        "INSERT INTO usage VALUES (?, ?, 1) ON CONFLICT(scope,period) DO UPDATE SET count=count+1",
      ).run(scope, period);
  }
  const day = () => new Date().toISOString().slice(0, 10);
  const allowed = new Set(
    (options.allowedWallets || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const wallet of allowed)
    if (!isAddress(wallet))
      throw Error("AI_ALLOWED_WALLETS contains an invalid address.");
  function allowedWallet(wallet) {
    if (!allowed.has(wallet.toLowerCase()))
      throw fail(
        403,
        "Dompet belum mendapat akses AI. Hubungi pengelola aplikasi.",
      );
  }
  return {
    db,
    close: () => db.close(),
    challenge(wallet) {
      if (!isAddress(wallet)) throw fail(400, "Alamat dompet tidak valid.");
      allowedWallet(wallet);
      return transaction(() => {
        const now = Date.now();
        db.prepare("DELETE FROM challenges WHERE expires < ?").run(now);
        db.prepare("DELETE FROM sessions WHERE expires < ?").run(now);
        db.prepare("DELETE FROM usage WHERE period < ?").run(
          new Date(now - 8 * 86400000).toISOString().slice(0, 10),
        );
        reserve([["login:" + wallet.toLowerCase(), day(), 30]]);
        const nonce = randomBytes(24).toString("hex"),
          expires = now + 300000;
        const message = [
          "Motochain Service",
          "Authorize receipt AI access",
          "Site: " + (options.publicUrl || "local"),
          "Wallet: " + wallet.toLowerCase(),
          "Nonce: " + nonce,
          "Expires: " + new Date(expires).toISOString(),
          "No blockchain transaction or token transfer.",
        ].join("\n");
        db.prepare("INSERT INTO challenges VALUES (?, ?, ?, ?)").run(
          nonce,
          wallet.toLowerCase(),
          message,
          expires,
        );
        return { nonce, message };
      });
    },
    login(nonce, signature) {
      return transaction(() => {
        const row = db
          .prepare("SELECT * FROM challenges WHERE nonce=?")
          .get(nonce);
        if (!row || row.expires < Date.now())
          throw fail(401, "Permintaan masuk kedaluwarsa atau sudah dipakai.");
        let signer;
        try {
          signer = verifyMessage(row.message, signature).toLowerCase();
        } catch {
          throw fail(401, "Tanda tangan tidak valid.");
        }
        if (signer !== row.wallet)
          throw fail(401, "Dompet penanda tangan tidak sesuai.");
        allowedWallet(signer);
        db.prepare("DELETE FROM challenges WHERE nonce=?").run(nonce);
        const token = randomBytes(32).toString("hex"),
          expires = Date.now() + 3600000;
        db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
          hashToken(token),
          signer,
          expires,
        );
        return { token, expires };
      });
    },
    authenticate(req) {
      const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
      if (!/^[a-f0-9]{64}$/.test(token))
        throw fail(
          401,
          "Hubungkan dan verifikasi dompet untuk menggunakan AI.",
        );
      const row = db
        .prepare("SELECT * FROM sessions WHERE token=?")
        .get(hashToken(token));
      if (!row || row.expires < Date.now())
        throw fail(401, "Sesi AI kedaluwarsa. Verifikasi dompet kembali.");
      allowedWallet(row.wallet);
      return row.wallet;
    },
    ai(wallet, maximum, perWallet = 10) {
      transaction(() =>
        reserve([
          ["ai:global", day(), maximum],
          ["ai:" + wallet, day(), perWallet],
        ]),
      );
    },
    storeMetadata(hash, raw, signer) {
      return transaction(() => {
        if (db.prepare("SELECT hash FROM metadata WHERE hash=?").get(hash))
          return;
        const bytes = Buffer.byteLength(raw);
        const total = db
          .prepare(
            "SELECT COALESCE(SUM(bytes),0) AS bytes, COUNT(*) AS files FROM metadata",
          )
          .get();
        if (
          total.bytes + bytes > (options.maxBytes ?? 100 * 1024 * 1024) ||
          total.files >= (options.maxFiles ?? 10000)
        )
          throw fail(507, "Penyimpanan penuh. Hubungi pengelola aplikasi.");
        reserve([
          ["metadata:global", day(), options.uploadsPerDay ?? 500],
          [
            "metadata:" + signer.toLowerCase(),
            day(),
            options.walletUploadsPerDay ?? 20,
          ],
        ]);
        try {
          writeFileSync(path.join(dataDir, hash + ".json"), raw, {
            flag: "wx",
          });
        } catch (e) {
          if (e.code !== "EEXIST") throw e;
        }
        db.prepare("INSERT INTO metadata VALUES (?, ?)").run(hash, bytes);
      });
    },
  };
}
