# Vercel frontend + Supabase backend

Frontend tetap di Vercel; backend metadata, autentikasi wallet dan Gemini berjalan di Supabase Edge Functions. Penyimpanan memakai PostgreSQL Supabase. VPS dan disk SQLite tidak diperlukan untuk runtime aktif.

## Vercel

Set VITE_API_URL=https://lbdeosccicyqrjevshya.supabase.co/functions/v1/motochain-api.
Set VITE_TESTNET_CONTRACT=0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9.
Biarkan VITE_MAINNET_CONTRACT kosong sampai kontrak Mainnet terpisah tersedia.
Build: npm run build; output dist; Node 24. vercel.json menjalankan pemeriksaan URL API sebelum build.

Jika environment VITE_API_URL belum didefinisikan, kode memakai alamat Supabase default. Nilai lama di dashboard tetap mengoverride default dan harus diperbarui. Frontend Vercel perlu redeploy agar konfigurasi baru berlaku; deployment lama tidak diubah oleh integrasi lokal ini.

GEMINI_API_KEY dan AI_ALLOWED_WALLETS disetel di Supabase Edge Function Secrets, bukan environment frontend. Tidak ada service-role key di Vercel/frontend.

## Domain Hostinger

Tambahkan domain frontend di Vercel lalu salin record DNS yang ditampilkan Vercel ke pengelola DNS aktif. Pertahankan MX/TXT email yang ada. Backend dapat tetap menggunakan alamat HTTPS Supabase. Integrasi ini tidak mengubah DNS.

## Verifikasi

Buka endpoint API /api/health: harus menunjukkan storage: supabase. Periksa unggah metadata, baca kembali, paspor publik, wallet challenge, dan Gemini setelah secret serta allowlist tersedia. Metadata baru mengembalikan URL HTTPS Supabase yang stabil untuk ditulis on-chain. Lihat SUPABASE.md untuk data yang dimigrasikan dan batasan URI lama.
