# Motochain Service

An owner-managed motorcycle service passport. One wallet registers a motorcycle, reviews receipt data extracted by Gemini, and saves service records. Public readers inspect history and its blockchain digest.

## Architecture

- React/Vite frontend, hosted on Vercel.
- Supabase Edge Function `motochain-api` verifies EVM signatures and serves the metadata/auth/Gemini APIs.
- Supabase PostgreSQL stores immutable public metadata, private wallet challenges, hashed sessions and daily quotas.
- BOT Chain remains authoritative for owner, motorcycle/record IDs, digests and metadata URIs.
- Receipt photos and source text are sent to Gemini only after consent and are not stored.

The backend is deployed at https://lbdeosccicyqrjevshya.supabase.co/functions/v1/motochain-api. Current schema, access controls, migration details and verification are in [SUPABASE.md](docs/SUPABASE.md).

## Local use

Use Node.js 24:
```sh
npm ci
npm run build
npm run dev
```

Copy .env.example to .env if needed without overwriting existing secrets. Open http://127.0.0.1:5173. VITE_API_URL points to the cloud API; when it is empty, the Node relay on port 3001 forwards /api to Supabase. The active server does not write JSON or SQLite files and does not fall back to disk on database failure. npm start serves the built frontend and the same relay.

The navbar separates **Garasi Saya** from **Tambah Catatan Servis**. Register/select a motorcycle, review receipt fields, then sign the metadata and blockchain transaction with the same owner wallet. Manual entry remains available without Gemini. The public passport and QR do not require login.

## Gemini

Set GEMINI_API_KEY, GEMINI_MODEL, and PUBLIC_URL in Supabase Dashboard → Edge Functions → Secrets. See supabase/functions/.env.example. Secrets in the local root .env do not automatically reach Supabase.

The default model is gemini-3.5-flash. AI accepts all valid EVM wallets and requires a verified wallet signature and an expiring session. Global and per-wallet daily quotas remain enforced. Only SHA-256 session-token hashes are stored. Public metadata uploads use a separate signed message and do not require an AI session.

Source photos/text are never stored. Only reviewed fields are saved. Provider requests consume the durable daily quota even if Gemini fails. Gemini does not establish receipt authenticity or repair accuracy.

## Blockchain version 2

Only the registered owner can submit a service. New records are immediately saved with status 1, labelled **Dicatat pemilik**. There is no mechanic workspace, second-wallet approval, ownership transfer or edit/delete workflow. Historical version 1 passports remain readable; writes to old contracts are blocked before metadata upload.

| Network | Chain ID | RPC | Explorer |
| --- | ---: | --- | --- |
| BOT Testnet | 968 | https://rpc.bohr.life | https://scan.bohr.life |
| BOT Mainnet | 677 | https://rpc.botchain.ai | https://scan.botchain.ai |

Testnet v2: 0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9. Mainnet is not configured. Test tokens: https://faucet.botchain.ai/basic.

For a new deployment, compile contracts/MotochainService.sol with Solidity 0.8.30, optimizer 200 runs and EVM Paris. Deploy using the owner wallet, Value 0, no constructor arguments. Check WORKFLOW_VERSION=2 and configure the corresponding VITE_TESTNET_CONTRACT or VITE_MAINNET_CONTRACT. No private key belongs in application configuration.

Metadata uploads now return a permanent Supabase HTTPS URL, including when the frontend runs locally. Old on-chain URIs remain unchanged; the frontend reads migrated localhost metadata from Supabase by its on-chain digest and verifies the hash. Unavailable HTTPS sources can also use this verified migration copy.

## Vercel

Set VITE_API_URL=https://lbdeosccicyqrjevshya.supabase.co/functions/v1/motochain-api and preserve the Testnet contract variable. Build with the existing vercel.json configuration, output dist, Node 24. Redeploy after changing build variables. The existing Vercel deployment has not been redeployed by this backend change.

An absent VITE_API_URL uses the project default; an existing old value in Vercel overrides it. Never put Gemini or Supabase secret/service-role keys in VITE_ variables. See [VERCEL-HOSTINGER.md](docs/VERCEL-HOSTINGER.md) for hosting/DNS.

Optional Docker Compose serves the frontend/relay with Caddy; no application disk volume or SQLite backup worker is needed. Old SQLite volumes/files are not deleted by this change.

## Validation

- npm test: 20 backend/contract tests, including the Supabase handler, signed wallet sessions, sanitized errors, relay and migrated metadata reads.
- npm run test:e2e: 9 browser scenarios, using isolated offline fixtures on ports 3002 and 5180.
- supabase/verify.sql and supabase/verify-backend.sql: database constraints, access control, atomic quotas and replay protection in rolled-back transactions.
- Live cloud verification: signed upload, four concurrent identical requests deduplicated into one row/quota increment, cloud and local relay readback, unauthorized AI denial.

The legacy SQLite adapter and backup scripts remain for offline regression tests and recovery of older archives. They are not imported by the active server entrypoint. Use PostgreSQL exports/backups for cloud data.

Tests do not constitute an independent security audit or evidence of a new public BOT transaction. Identity represents a managing wallet, not legal ownership. Hashes detect alteration but cannot prove physical repairs or recover missing metadata.

## Main files

- src/main.jsx: garage, registration, service-entry page and public history.
- src/ReceiptAssistant.jsx: consent, Gemini preview and explicit draft application.
- src/lib/chain.js: wallet, contract guard, metadata and transaction proof.
- contracts/MotochainService.sol: owner-only append-only records.
- server/edge-handler.js and server/supabase-store.js: current API and persistence.
- server/receipt.js: shared receipt validation and Gemini adapter.
- server/index.js and server/proxy.js: local/static frontend relay.
- supabase/functions/motochain-api/: deployed entrypoint and dependency map.
- supabase/migrations/: schema and transactional backend RPC.
- docs/SUPABASE.md: current deployment and migration notes.
- PRD-Motochain-Service.md: product requirements.

Competition submission and Mainnet deployment remain separate work; see docs/SUBMISSION.md.
