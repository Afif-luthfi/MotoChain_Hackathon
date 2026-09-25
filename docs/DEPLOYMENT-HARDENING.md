# Public deployment hardening

> Historical SQLite/file deployment guide. The active backend now uses Supabase Edge Functions and PostgreSQL; see [SUPABASE.md](SUPABASE.md). These disk/backup instructions apply only to recovering the older deployment.

Implemented: durable SQLite quotas, signed wallet sessions for public Gemini, immutable metadata limits, verified backup/restore, Docker persistent volumes and Caddy HTTPS configuration.

## Deployment

Use Node 24.13+ (the current project runtime is 24.17). Local development continues to use loopback HTTP. Production refuses relative DATA_DIR, a non-HTTPS PUBLIC_URL, and public AI without an allowlist.

1. Choose a VPS with Docker Compose and a public domain. Point its DNS to that VPS and allow ports 80/443. Caddy obtains and renews HTTPS certificates: https://caddyserver.com/docs/automatic-https.
2. Set DOMAIN to the backend hostname only and PUBLIC_URL to the frontend HTTPS origin. For Vercel + Hostinger, follow VERCEL-HOSTINGER.md. Keep the Gemini key in the backend .env, never VITE_ variables. Set AI_ALLOWED_WALLETS to the comma-separated wallet addresses of your team and approved testers.
3. Keep VITE_TESTNET_CONTRACT as the existing Testnet address. Set VITE_MAINNET_CONTRACT=0xA665c9a42571AAf3Cd0881421446060e0C1F9d92.
4. Run docker compose config --quiet, then docker compose up -d --build on the host.
5. Verify https://YOUR_DOMAIN/api/health, wallet login, receipt extraction, metadata save/read and transaction proof from another device before announcing deployment.
6. Inspect docker compose logs backup. A verified snapshot is created at startup and every six hours in app_backups. Copy verified snapshots to another host or encrypted object storage. A backup volume on the same VPS does not protect against loss of that VPS.
7. Do not use docker compose down -v: it deletes persistent volumes. Keep the domain and metadata URL stable.

The app port is internal to Docker; only Caddy exposes public ports. Do not expose port 3001 separately. The server deliberately does not trust arbitrary X-Forwarded-For headers; its IP limit is shared behind the proxy. Wallet quotas are separate. This conservative limit suits a small hackathon deployment.

## Gemini access

Public mode requires a one-time challenge signed by an allowed wallet. The challenge names this application and its configured origin, expires in five minutes, and cannot be reused. Session tokens expire after one hour; only token hashes are stored. Tokens stay in browser memory rather than localStorage. Removing a wallet from the allowlist and restarting revokes its access.

The client asks for a signature only when reading a receipt. This does not create an on-chain transaction. Local-only mode does not require login; its spending quota is nevertheless persistent.

Default daily limits (UTC): 50 provider requests globally, 10 per wallet; 5/minute/IP and 2 concurrent requests per app process. An attempted provider call counts even when Gemini fails, conservatively bounding spend. Counts survive restart and use SQLite transactions for concurrent workers on the same local disk. Do not horizontally scale across separate disks or network filesystems.

Receipt photos/text are never inserted into SQLite or backup files. The database stores quota counters, auth challenges/session hashes and metadata size accounting.

## Metadata

Existing hash-named JSON files are kept at their original paths and reconciled into quota accounting at startup. New uploads require the existing wallet signature. Limits default to 20 unique uploads/wallet/day, 500 globally/day, 10,000 files and 100 MiB of metadata payloads. These bounds apply even if no blockchain transaction follows. Identical retries do not consume storage quota. Limits do not cover logs, SQLite overhead or backups; monitor filesystem capacity.

A reached limit returns 429 or 507; no existing record is deleted. Metadata remains public and immutable. Server data loss still means lost readable details unless a backup is restored; blockchain stores the digest and URL, not the full details.

## Backup and recovery

Manual backup:
    node scripts/backup.js
Verify:
    node scripts/backup.js verify ABSOLUTE_SNAPSHOT_DIRECTORY
Restore (stop the application first; destination MUST be empty):
    node scripts/backup.js restore ABSOLUTE_SNAPSHOT_DIRECTORY ABSOLUTE_NEW_DATA_DIRECTORY

Point DATA_DIR at the restored directory and restart. Restore preserves quotas and removes all login sessions/challenges. Snapshots include a consistent SQLite backup, immutable JSON metadata and a SHA-256 manifest. Verification checks both file checksums and SQLite integrity and confirms all indexed metadata is present. No Gemini API key or receipt source is included. Protect snapshots because they contain public metadata and authentication accounting.

For Docker, export a snapshot with docker compose cp backup:/backups/SNAPSHOT ./offsite-snapshot. Store it off-host and verify it before discarding older copies. Retention is operator-controlled; check backup disk usage regularly.

## Verification and limitations

Automated tests cover unauthorized/replayed/expired auth, limits after server restart, storage caps and duplicate uploads, backup restore and corruption detection, and production configuration rejection. Existing contract and UI tests remain in place.

Docker engine and a real domain are required to test container startup, certificate issuance and public reachability. Configuration files alone do not mean the site has been deployed or HTTPS has been verified. Existing Testnet records containing localhost URLs do not become public automatically; the new public deployment must preserve a reachable metadata URL for new records.

UI gate: existing booklet design and navigation retained (ENERGY 2 / RHYTHM 3 / MOTION 1). Only the receipt explanation gains the wallet-signature notice; it is shown only when public authentication is required. No new visual assets.
