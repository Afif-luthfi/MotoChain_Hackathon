# Verification: owner workflow version 2
Date: 24 September 2026

- PASS: Solidity 0.8.30 / Paris compilation and Vite production build.
- PASS: 9 Node tests for owner-only contract writes, immutable records, metadata signatures/integrity and Gemini handling.
- PASS: 8 browser scenarios after updating the wallet mock to simulate the legacy contract on both public RPC and wallet RPC.
- PASS: one wallet registers a motor and saves a record in actual local-EVM transactions; no mechanic permission or second decision transaction.
- PASS: switching to another wallet removes the owner form; contract rejects non-owner submission.
- PASS: legacy contract passports remain readable and legacy writes fail before metadata upload.
- PASS: Gemini mocked preview requires consent and review; blank AI values preserve manually entered fields.
- PASS: missing key/provider errors/unsupported images leave manual entry available.
- PASS: demo save survives reload, registration opens new passport, malformed/missing passport states display errors.
- PASS: altered historical metadata is flagged; stored service fields exclude photo/source text.
- PASS: QR, copy link, mobile navigation, reset confirmation and keyboard skip.
- PASS: screenshot inspection at 1440px and 390px, with automated no-horizontal-overflow assertion.

Evidence: tests/contract.test.js, tests/storage.test.js, tests/ai.test.js, tests/browser/app.spec.js, chain.spec.js, ai.spec.js. Screenshots: owner-desktop.png and owner-mobile.png under docs/screenshots.

The original browser run had one harness failure: the legacy-version mock affected the public RPC but not the wallet RPC. Both now simulate the same legacy behavior, and that scenario passes.

## Remaining external work
Version 2 requires a new deployment. No public v2 address or migration is claimed. MetaMask signatures on public BOT, cross-device metadata hosting, and submission steps remain external work.

Gemini text/photo smoke testing succeeded before the workflow change using gemini-3.5-flash; the new owner UI uses automated mocked responses for reproducible checks. General receipt accuracy is unmeasured.

Local EVM uses a wallet-compatible test provider, not the real MetaMask extension. Ganache's optional uWS warning falls back to JavaScript; inherited dev dependency audit findings remain. Independent contract audit, persistent metadata backup and public AI access control remain operational requirements.

See OWNER-WORKFLOW.md and SUBMISSION.md.

## Navbar follow-up: 25 September 2026
- PASS: Garasi Saya lists motorcycles without rendering a service form.
- PASS: Tambah Catatan Servis opens a motorcycle selector; selecting one opens its owner-only Gemini/form page.
- PASS: saving returns to that motor's information and history; local EVM scenario still passes.
- PASS: production build and all 8 browser scenarios.
- PASS: garage, information/history and service-entry pages fit 1440px and 390px; six screenshots captured as nav-{garage,motor,service}-{width}.png.
- PASS: desktop motor-information and mobile garage screenshots inspected. Active navbar state uses text underline and aria-current; mobile Menu retains existing behavior.
- PASS: existing owner workflow UI gate remains applicable to palette, typography, controls, consent, permissions and honest demo labels. Updated composition follows the user's requested task navigation.
This navigation change does not change the v2 contract or require another v2 deployment.
