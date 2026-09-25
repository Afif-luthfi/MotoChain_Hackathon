# Motochain Service

An owner-managed motorcycle service passport. One wallet registers the motorcycle, reviews receipt data extracted by Gemini, and saves service records. Public readers can inspect history and its blockchain digest.

## Version 2

The mechanic workspace, mechanic permissions and second-wallet approval were removed at the user's request. A saved service is labelled **Dicatat pemilik**, not workshop-verified. Photos and source receipt text are used only for Gemini extraction and are not stored.

**BOT Testnet v2 is configured at 0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9.** Read-only verification on 25 September 2026 confirmed chain ID 968, WORKFLOW_VERSION=2, one motorcycle and one service record. An existing version 1 deployment cannot be upgraded at its address. Old passports remain readable; writes to incompatible contracts are blocked before metadata upload. Mainnet deployment and website hosting are not completed by this change.

## Local use

Use Node.js 24 and npm:

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:5173. The API listens on port 3001. For the built application, run npm start and open http://127.0.0.1:3001.

The navbar separates **Garasi Saya** from **Tambah Catatan Servis**. Garage entries open motorcycle information and its service history. To add a record, open Tambah Catatan Servis, select a motorcycle, upload a redacted receipt or paste its text, consent to Gemini, review its draft and apply it. Complete missing fields, click **Periksa catatan**, then **Simpan catatan**. Successful saving returns to that motorcycle's information and history. Manual entry remains available if AI cannot read the receipt.

On BOT, the same wallet signs the metadata upload and sends the service transaction. There is no separate approval transaction. Another wallet cannot append to your motorcycle.

The application supports BOT Testnet and BOT Mainnet, with Testnet as the default. Mainnet remains unconfigured until a separate contract is deployed there. There is no local demo mode or seeded motorcycle. Previous saved demo selections fall back to Testnet; unsupported network links are rejected rather than interpreted as on-chain IDs. Historical demo storage is left untouched but never loaded. Test fixtures live only under tests and are not bundled into the application.

## Gemini

Set GEMINI_API_KEY on the server, keeping the existing key out of source control. Never use a VITE_ prefix. The server reads .env at startup. Default GEMINI_MODEL is gemini-3.5-flash, previously verified with synthetic text and image requests. Restart the API after configuration changes.

Photo and source text are not written to disk. Only the reviewed service fields are uploaded after the owner saves. Google receives the source only after explicit consent. AI output does not establish receipt authenticity or repair accuracy.

See [GEMINI.md](docs/GEMINI.md) for quotas and provider troubleshooting.

## Deploy version 2

1. Upload contracts/MotochainService.sol to Remix.
2. Compile with Solidity 0.8.30, optimizer enabled with 200 runs, EVM Paris.
3. Choose Browser Extension / MetaMask and the target BOT network: Testnet (968) or Mainnet (677).
4. Deploy MotochainService with Value 0 and no constructor arguments.
5. Verify WORKFLOW_VERSION returns 2.
6. Save the new address under **Jaringan**. The UI checks chain ID, deployed code and workflow version.
7. Register the motorcycle again on the new contract, then save a service using that same wallet.

| Network | Chain ID | RPC | Explorer |
|---|---:|---|---|
| BOT Testnet | 968 | https://rpc.bohr.life | https://scan.bohr.life |
| BOT Mainnet | 677 | https://rpc.botchain.ai | https://scan.botchain.ai |

Test tokens: https://faucet.botchain.ai/basic. Testnet contract: https://scan.bohr.life/address/0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9. Mainnet is not configured. Preserve your version 1 address to open its history.

The on-chain Record tuple retains its earlier field layout for historical reads. New records are created immediately with status 1; this means saved in workflow v2, not two-party approval. No setMechanic or decideService function exists in v2.

## Publish the application

The deployment package, persistent quotas, public AI wallet allowlist, and backup/restore procedure are documented in [DEPLOYMENT-HARDENING.md](docs/DEPLOYMENT-HARDENING.md). Public HTTPS still needs a configured host and domain; the supplied Docker Compose configuration does not publish the site by itself.

Edit the existing .env or hosting environment without overwriting secrets:

```text
VITE_TESTNET_CONTRACT=0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9
VITE_MAINNET_CONTRACT=
VITE_API_URL=https://your-metadata-api.example
```

These are placeholders. Build again after changing VITE_ values. Browser-local contract settings only affect that browser; build settings take precedence.

Build: npm ci followed by npm run build. Publish dist for static hosting. GitHub Pages cannot execute the API; host server/index.js separately on a Node service with HTTPS and persistent storage. Alternatively npm start serves both API and dist from one Node server; leave VITE_API_URL empty for same-origin hosting.

Server settings: HOST=0.0.0.0 on a managed host, hosting-provided PORT, DATA_DIR set to a persistent absolute directory, ALLOWED_ORIGIN set to the exact frontend HTTPS origin. Keep backups and preserve published metadata URLs.

AI remains local-only by default. Public Gemini use requires AI_ALLOW_REMOTE=true plus appropriate access controls and quotas. Do not expose unrestricted key usage. GEMINI_API_KEY stays on the backend.

Before creating shared on-chain records, configure a durable public metadata endpoint. Localhost metadata URLs are not accessible from other people's devices.

## Validation and limits

npm test runs contract, metadata and Gemini adapter tests. npm run test:e2e runs browser scenarios including real transactions on a disposable local EVM. The local EVM test is not evidence of public BOT deployment. See [VERIFICATION.md](docs/VERIFICATION.md).

Public passport identity represents a managing wallet, not legal ownership. Service data is an owner's statement. Hashes detect alteration but cannot prove that physical repairs occurred, nor recover missing metadata. Photo storage, ownership transfer, corrections and independent workshop verification are outside this version.

Ganache is a development-only harness. Its optional uWS binary falls back to JavaScript on Node 24, and bundled dependencies have reported audit findings. It is not imported by the frontend or API. The contract has not had an independent security audit.

## Main files

- src/main.jsx: garage, separate service-entry page, motorcycle information/history, public passport, registration and settings.
- src/ReceiptAssistant.jsx: consent, Gemini preview and explicit draft application.
- src/lib/chain.js: wallet, contract version guard, metadata and transaction proof.
- contracts/MotochainService.sol: owner-only append-only service records.
- server/: metadata and Gemini APIs.
- docs/OWNER-WORKFLOW.md: new deployment and usage guide.
- PRD-Motochain-Service.md: version 2 requirements, retaining the 17-section structure.

## References

- BOT documentation: https://dev-docs.botchain.ai/docs/intro/
- Remix: https://remix.ethereum.org
- Hackathon guide: https://www.girlmeetstech.org/guidebook-build-week-hackathon-vol2
