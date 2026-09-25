import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdir,
  readdir,
  copyFile,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const sha = (raw) => createHash("sha256").update(raw).digest("hex");
export async function verifyBackup(directory) {
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  if (manifest.version !== 1 || !Array.isArray(manifest.files))
    throw Error("Invalid backup manifest.");
  for (const row of manifest.files) {
    if (!/^(security\.sqlite|0x[a-f0-9]{64}\.json)$/.test(row.name))
      throw Error("Invalid backup path.");
    if (sha(await readFile(path.join(directory, row.name))) !== row.sha256)
      throw Error("Backup checksum mismatch: " + row.name);
  }
  if (!manifest.files.some((row) => row.name === "security.sqlite"))
    throw Error("Database missing.");
  const db = new DatabaseSync(path.join(directory, "security.sqlite"), {
    readOnly: true,
  });
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Database integrity failed.");
    const names = new Set(manifest.files.map((row) => row.name));
    for (const row of db.prepare("SELECT hash FROM metadata").all())
      if (!names.has(row.hash + ".json"))
        throw Error("Metadata missing from backup.");
  } finally {
    db.close();
  }
}
export async function createBackup(dataDir, backupDir) {
  const source = path.resolve(dataDir),
    root = path.resolve(backupDir);
  if (root === source || root.startsWith(source + path.sep))
    throw Error("Backup directory must be outside DATA_DIR.");
  await mkdir(root, { recursive: true });
  const dest = path.join(
    root,
    new Date().toISOString().replaceAll(":", "-") + "-" + process.pid,
  );
  await mkdir(dest);
  const db = new DatabaseSync(path.join(source, "security.sqlite"));
  try {
    await backup(db, path.join(dest, "security.sqlite"));
  } finally {
    db.close();
  }
  // Metadata is immutable: copy all records after the consistent SQLite snapshot.
  for (const name of await readdir(source))
    if (/^0x[a-f0-9]{64}\.json$/.test(name))
      await copyFile(path.join(source, name), path.join(dest, name));
  const files = [];
  for (const name of await readdir(dest))
    files.push({ name, sha256: sha(await readFile(path.join(dest, name))) });
  await writeFile(
    path.join(dest, "manifest.json"),
    JSON.stringify(
      { version: 1, createdAt: new Date().toISOString(), files },
      null,
      2,
    ),
  );
  await verifyBackup(dest);
  return dest;
}
export async function restoreBackup(source, dest) {
  await verifyBackup(source);
  await mkdir(dest, { recursive: true });
  if ((await readdir(dest)).length)
    throw Error("Restore requires an empty destination.");
  const manifest = JSON.parse(
    await readFile(path.join(source, "manifest.json"), "utf8"),
  );
  for (const row of manifest.files)
    await copyFile(path.join(source, row.name), path.join(dest, row.name));
  const db = new DatabaseSync(path.join(dest, "security.sqlite"));
  try {
    db.exec("DELETE FROM sessions; DELETE FROM challenges;");
  } finally {
    db.close();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("scripts/backup.js")
) {
  if (process.argv[2] === "verify") {
    await verifyBackup(process.argv[3]);
    console.log("Backup verified.");
  } else if (process.argv[2] === "restore") {
    await restoreBackup(process.argv[3], process.argv[4]);
    console.log("Restore complete; sessions revoked.");
  } else
    console.log(
      await createBackup(
        process.env.DATA_DIR || "./data",
        process.env.BACKUP_DIR || "./backups",
      ),
    );
}
