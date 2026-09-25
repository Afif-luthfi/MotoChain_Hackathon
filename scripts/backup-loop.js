import { createBackup } from "./backup.js";
const interval = Number(process.env.BACKUP_INTERVAL_HOURS || 6);
if (!Number.isFinite(interval) || interval < 1)
  throw Error("Invalid backup interval.");
for (;;) {
  try {
    console.log(
      "Backup verified:",
      await createBackup(process.env.DATA_DIR, process.env.BACKUP_DIR),
    );
  } catch {
    console.error("Backup failed. Check storage and permissions.");
  }
  await new Promise((resolve) => setTimeout(resolve, interval * 3600000));
}
