# MotoChain Service

A blockchain-based digital motorcycle service book, with Gemini helping read service receipts.

## 1. Project Name and Summary

**MotoChain Service** is an owner-managed digital motorcycle service book. Owners can register a motorcycle, save service history, and share a public passport backed by records on BOT Chain.

Gemini only prepares a draft from a receipt photo or text. The owner must review, edit, and save every record.

## 2. Website and Demo Links

- **Production website:** [Vercel deployment](https://motochain-hackathon-ssn31pny5-afif-luthfi06.vercel.app) — verify or redeploy it so it is publicly accessible before submission.
- **Demo video:** no video link yet.
- **Repository:** [Afif-luthfi/MotoChain_Hackathon](https://github.com/Afif-luthfi/MotoChain_Hackathon)
- **Blockchain:** BOT Chain Testnet, Chain ID `968`.
- **Mainnet target:** BOT Chain Mainnet, Chain ID `677`; the Mainnet contract address is not available yet.
- **Testnet contract:** [`0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9`](https://scan.bohr.life/address/0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9)

The BOT Chain explorer is available at [scan.botchain.ai](https://scan.botchain.ai).

## 3. Main Features

- **Owner's garage:** view motorcycles registered to the active wallet.
- **Motorcycle registration:** register a motorcycle and receive its ID.
- **Receipt reading:** upload a photo or paste receipt text to generate a Gemini draft.
- **Service history:** save the date, odometer, complaint, work performed, and parts.
- **Public passport:** view history through a motorcycle ID or QR code without logging in.
- **Manual entry:** remains available when Gemini is unavailable or an AI result needs correction.
- **Wallet integration:** connects to MetaMask and BOT Chain networks.

## 4. Short Workflow

```text
Owner connects wallet → registers motorcycle → enters or reads a receipt → reviews the result → saves the record
```

Reviewed metadata is stored through the backend, and its digest and URI are recorded in the smart contract. The motorcycle ID, record relationships, and recorder address remain authoritative on BOT Chain.

## 5. Architecture and Technology

| Component  | Technology                           |
| ---------- | ------------------------------------ |
| Frontend   | React, Vite, and Vercel              |
| Backend    | Supabase Edge Functions              |
| Database   | Supabase PostgreSQL                  |
| Blockchain | Solidity smart contract on BOT Chain |
| AI         | Google Gemini for receipt reading    |
| Wallet     | MetaMask and EVM networks            |

The smart contract is in [`contracts/MotochainService.sol`](contracts/MotochainService.sol). Wallet and contract integration is in [`src/lib/chain.js`](src/lib/chain.js), while the receipt assistant is in [`src/ReceiptAssistant.jsx`](src/ReceiptAssistant.jsx).

## 6. Running Locally

### Requirements

- Node.js 24
- npm
- MetaMask
- A BOT Chain Testnet wallet with BOT for gas

### Run the Project

```sh
git clone https://github.com/Afif-luthfi/MotoChain_Hackathon.git
cd MotoChain_Hackathon
npm ci
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:5173` in a browser. Copy `.env.example` only if `.env` does not already exist; do not overwrite secrets that are already configured.

## 7. Environment Configuration

### Frontend Variables on Vercel

The following values are safe to expose to the frontend:

```text
VITE_API_URL=https://<project-ref>.supabase.co/functions/v1/motochain-api
VITE_TESTNET_CONTRACT=0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9
VITE_MAINNET_CONTRACT=
```

Keep `VITE_MAINNET_CONTRACT` empty until the version 2 contract is available on Mainnet. Never put a private key or a Gemini API key in a `VITE_` variable.

### Backend Secrets on Supabase

Configure these secrets in **Supabase Dashboard → Edge Functions → Secrets**:

```text
GEMINI_API_KEY=<server-only-secret>
GEMINI_MODEL=gemini-3.5-flash
PUBLIC_URL=https://<production-domain>
```

Never commit an actual API key to the repository. See [`docs/SUPABASE.md`](docs/SUPABASE.md) and [`supabase/functions/.env.example`](supabase/functions/.env.example) for the complete setup.

For the local relay, `.env.example` also provides `SUPABASE_API_URL`, `PORT`, and `HOST`.

## 8. Deployment and Testing

### Deployment

- Deploy the frontend to Vercel with `npm run build` as the build command and `dist` as the output directory.
- Run metadata storage, wallet authentication, and Gemini through Supabase Edge Functions.
- Deploy the smart contract to BOT Chain using Remix or the Solidity compiler. Use compiler `0.8.30`, optimizer `200` runs, EVM `Paris`, value `0`, and no constructor arguments.
- The version 2 contract must return `WORKFLOW_VERSION = 2`.
- Add the deployed address to `VITE_TESTNET_CONTRACT` or `VITE_MAINNET_CONTRACT`, then rebuild the frontend.

Detailed guides:

- [Supabase setup](docs/SUPABASE.md)
- [Vercel and domain deployment](docs/VERCEL-HOSTINGER.md)
- [Owner workflow and contract deployment](docs/OWNER-WORKFLOW.md)
- [Hackathon submission checklist](docs/SUBMISSION.md)
- [Hackathon guidebook](https://www.girlmeetstech.org/guidebook-build-week-hackathon-vol2)

### Testing

```sh
npm test
npm run test:e2e
npm run build
```

The tests cover the contract, wallet authorization, metadata integrity, receipt validation, the Gemini workflow, and several browser scenarios. Automated test results are not evidence of a public BOT transaction or an independent security audit.

## 9. Privacy and Limitations

- Service history and passports are **public** to anyone with the link or QR code.
- Only the owner's wallet can add a record to that motorcycle.
- Receipt photos and source text are not stored by the application; they are processed only after user consent.
- Gemini output must always be reviewed and can be edited before it is saved.
- A saved record is an owner-submitted record, not independent verification of a workshop, receipt, or physical repair.
- Metadata hashes help detect changes but do not prove that a motorcycle or part was actually repaired.
- The Mainnet contract and final production domain still need to be completed.

## 10. Team and License

### Contributors

- Afif Luthfi
- Syauqi Radhi
- Muhammad Oktafriansyah

Hackathon-specific role assignments have not been documented yet and should be added before submission.

### License

No license has been selected. This repository does not currently contain a `LICENSE` file; add the license agreed by the team before publication or submission.

Detailed SQL, migrations, deployment configuration, troubleshooting, and verification notes are available in the [`docs/`](docs/) folder.
