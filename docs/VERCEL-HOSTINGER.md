# Vercel frontend + domain Hostinger

Frontend: Vercel. Domain/DNS: Hostinger. Backend Node (Gemini, SQLite, JSON metadata and backups): a separate host with a persistent disk. Do not run this filesystem backend inside Vercel Functions or put the database in /tmp.

## Frontend setup

Import this project into Vercel. vercel.json configures Vite, build and dist output. Select Node 24. Set these public build variables:
- VITE_TESTNET_CONTRACT=0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9
- VITE_MAINNET_CONTRACT empty until Mainnet contract deployment
- VITE_API_URL=https://api.YOUR_DOMAIN

The Vercel build intentionally fails if the backend URL is missing or not HTTPS. Set GEMINI_API_KEY only on the backend, not the Vercel frontend.

Add your domain in Vercel project settings. In Hostinger DNS, copy the exact records Vercel provides; do not guess IP/CNAME values. If your nameservers are managed elsewhere, edit records there. Preserve existing email MX/TXT records.
Official reference: https://vercel.com/docs/domains/set-up-custom-domain

## Backend setup (if a VPS is available)

Use the provided Docker Compose package on the VPS. Domain ownership alone does not supply a VPS.

Set DOMAIN=api.YOUR_DOMAIN for the Caddy endpoint, PUBLIC_URL=https://YOUR_DOMAIN for the frontend origin, and AI_ALLOWED_WALLETS to approved team/tester addresses. Set the server Gemini key. Point the api DNS record to the backend host. Only expose 80/443 publicly. ALLOWED_ORIGIN defaults to PUBLIC_URL, which allows authenticated cross-origin requests including the Authorization header.

Run docker compose config --quiet and docker compose up -d --build. Follow DEPLOYMENT-HARDENING.md for backups and recovery. app_data and app_backups are persistent volumes. Verify a snapshot and move copies off-host.

If you have only a domain and Vercel, backend hosting remains to be selected. An alternative architecture is a managed database/object store with serverless endpoints; the current SQLite/file backend is not that architecture.

## Final acceptance

Check the production frontend in a second browser/device: wallet challenge, Gemini extraction, new metadata upload/read, public motorcycle history and proof. Check that mainnet metadata URLs reference https://api.YOUR_DOMAIN, not localhost. Confirm valid HTTPS for both frontend and API, quota persistence after backend restart, and a verified off-host backup.

No public deployment, DNS change or paid hosting purchase has been performed by these code changes.
