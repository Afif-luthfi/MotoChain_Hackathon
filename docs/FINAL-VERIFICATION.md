# Final verification: 25 September 2026

## Application
PASS: local demo option, banner, role, reset action, seeded data and demo write implementation removed.
PASS: only BOT Testnet and BOT Mainnet remain, default Testnet.
PASS: saved demo network preference resolves to Testnet; old demo passport routes are rejected rather than mapped to an unrelated live motor ID.
PASS: no demo storage is read, copied into blockchain, or deleted.
PASS: owner-only registration/service workflow, Gemini review, navbar and public history remain available.
PASS: source photos are not stored; Gemini key remains server-only.

## Tests and live inspection
PASS: production build and Solidity compilation.
PASS: 9 Node tests and 7 browser scenarios.
PASS: tests use a separate Vite server on port 5180 with contract build variables cleared. Public configuration at port 5173 is not replaced by test fixtures.
PASS: actual local-EVM registration, service save, foreign-wallet denial and legacy version guard.
PASS: testnet RPC verified user contract 0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9, chain 968, version 2, motorCount=1, recordCount=1.
PASS: the same address has no code on mainnet; it is not used as the mainnet configuration.
PASS: live public passport #1 loaded in the browser, metadata verified, no page errors or alerts.
PASS: API health HTTP 200; app restarted with final settings.
PASS: mobile passport has no horizontal overflow; inspected screenshot final-passport-mobile.png.

## UI gate
PASS: inherited paper/ink/rust design, contrast and focus styles retained.
PASS: labels distinguish testnet from mainnet; no simulated entries presented as real records.
PASS: unavailable wallet/contract and invalid legacy route states provide next actions.
PASS: mobile navigation, desktop rendering and owner form controls covered by browser checks.
PASS: no new assets, claims, decorative effects or template sections added.
The full OWNER-UI-CHECK.md gate remains applicable; this report updates its retired demo references.

## Public-release boundary
Frontend is still hosted locally at 127.0.0.1:5173. Public website/domain, durable HTTPS metadata hosting, mainnet contract and hackathon submission remain separate work. No private key was used or requested, and no blockchain transaction was sent during this verification.

## Hardening follow-up — 25 September 2026

- 13 backend/contract tests passed, including durable quotas after restart, unauthorized/replayed/expired wallet sessions, metadata capacity and backup/restore/corruption checks.
- 8 existing browser tests passed; 4 AI browser tests then passed after adding the public wallet-signature flow (9 distinct browser tests total).
- Final production build passed. Docker Compose configuration validated without printing secrets; container execution was not tested because Docker engine is unavailable.
- Created and verified local snapshot: backups/2026-09-25T04-20-00.583Z-1848.
- API and frontend restarted locally. No public deployment or blockchain transaction performed.
- User selected Vercel frontend and a Hostinger domain only. Vercel configuration and split-origin guide added; a persistent backend host and public DNS/TLS verification are still outstanding. See VERCEL-HOSTINGER.md.
