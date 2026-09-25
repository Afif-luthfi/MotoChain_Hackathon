# Supabase Motochain Service

## Status — 25 September 2026

Backend aktif di Supabase Edge Functions dan seluruh penyimpanan aplikasi aktif menggunakan PostgreSQL Supabase. Frontend lokal telah diarahkan ke API ini. Deployment Vercel lama belum di-redeploy dalam perubahan ini.

- Project: motochain-service, radhiathl's Org, Singapore.
- Ref: lbdeosccicyqrjevshya.
- Dashboard: https://supabase.com/dashboard/project/lbdeosccicyqrjevshya
- API: https://lbdeosccicyqrjevshya.supabase.co/functions/v1/motochain-api
- Health: https://lbdeosccicyqrjevshya.supabase.co/functions/v1/motochain-api/api/health
- Biaya project yang dikonfirmasi saat pembuatan: US$0/bulan, mengikuti batas paket Supabase.
- Database internal tetap bernama postgres.

## Alur aplikasi

Frontend → Supabase Edge Function → RPC service-only → PostgreSQL.

Edge Function memeriksa format, tanda tangan wallet, timestamp dan sesi. Satu transaksi database menangani metadata dan seluruh kuota yang terkait. Tidak ada password database atau service-role key di browser. Runtime Supabase menyediakan key backend; tidak perlu menaruhnya di komputer lokal.

npm run dev menyediakan Vite dan relay Node. Frontend memakai VITE_API_URL; jika kosong, /api diteruskan relay ke Supabase. Jika variabel tidak didefinisikan, build memakai alamat API Supabase project ini. Relay tidak membuka SQLite, tidak menulis JSON dan tidak melakukan fallback ke disk jika Supabase gagal.

Kode SQLite lama di server/app.js, server/security.js, server/config.js dan skrip backup dipertahankan hanya untuk tes offline dan pemulihan arsip lama. server/index.js tidak mengimpor adapter tersebut. Browser tests menjalankan backend fixture tersendiri di port 3002 sehingga tidak menulis data palsu ke cloud.

## Data

| Tabel | Isi | Akses |
| --- | --- | --- |
| public.metadata | raw JSON kanonis, hash Keccak-256, JSONB data, bytes, created_at | Publik baca; backend insert saja |
| private.challenges | Nonce sekali pakai, wallet, pesan, expiry milidetik | Backend saja |
| private.sessions | Hash SHA-256 token, wallet, expiry milidetik | Backend saja |
| private.usage | Scope, tanggal UTC, jumlah pemakaian | Backend saja |

RLS aktif. Role aplikasi tidak dapat mengubah/menghapus metadata. Administrator memiliki hak pemeliharaan. Foto dan teks nota mentah tidak masuk database.

Motor menyimpan kind/name/brand/model/year/color/marker; servis menyimpan kind/date/odometer/complaint/action/parts. Blockchain BOT tetap menentukan owner, ID, hubungan catatan, digest dan URI. Upload metadata belum berarti transaksi on-chain berhasil.

RPC public.motochain_backend hanya diberi EXECUTE kepada service_role. Fungsi SECURITY INVOKER memakai advisory transaction lock untuk serialisasi singkat saat reservasi kuota, deduplikasi, pengecekan kapasitas, konsumsi challenge dan pembuatan sesi. Panggilan Gemini tidak memegang lock database. Gagal pada satu kuota membatalkan semua penghitung dalam transaksi itu.

Kuota default: 500 metadata unik global/hari, 20/wallet/hari, 10.000 metadata, 100 MiB payload; 30 challenge/wallet/hari; 50 AI global/hari dan 10/wallet/hari. Retry metadata identik tidak dihitung ulang. Percobaan Gemini yang sudah direservasi tetap dihitung walau provider gagal. Pembatasan tambahan per menit dan dua permintaan AI aktif berlaku per instance Edge Function, bukan lock global. Batas biaya lintas instance ditopang kuota harian database. Timestamp/expiry memakai waktu database untuk sesi.

## Lokal dan Vercel

1. Gunakan Node 24, jalankan npm ci.
2. Salin .env.example menjadi .env jika belum ada; pertahankan secret yang sudah dimiliki.
3. Jalankan npm run dev. Buka http://127.0.0.1:5173.
4. Untuk Vercel, set VITE_API_URL ke alamat API di atas, pertahankan VITE_TESTNET_CONTRACT, lalu redeploy frontend. Jangan memakai URL Supabase root sebagai VITE_API_URL.
5. Cek /api/health pada endpoint Edge. Respons sukses menyertakan storage: supabase.
6. Upload metadata baru mengembalikan URL HTTPS Supabase absolut. URI yang dicatat blockchain tidak memakai localhost meski frontend berjalan lokal.

Sesi wallet AI menggunakan challenge khusus EVM, bukan akun email/password Supabase Auth. verify_jwt=false pada fungsi diperlukan karena autentikasi dilakukan sendiri: wallet signature untuk upload, session token untuk AI. GET metadata/health/status sengaja publik. CORS mengizinkan pembacaan metadata lintas origin; CORS bukan kontrol otorisasi.

## Gemini

Isi GEMINI_API_KEY, GEMINI_MODEL, dan PUBLIC_URL di Dashboard → Edge Functions → Secrets. Contoh ada di supabase/functions/.env.example. Secret Gemini sudah tersimpan dan endpoint status configured:true. Pengujian nyata masih mengalami timeout/503 dari provider. Kunci Gemini lokal tidak otomatis dipindahkan ke cloud.

Tidak ada bypass autentikasi AI untuk localhost: request tetap menuju backend publik. Semua wallet EVM boleh memakai AI setelah verifikasi tanda tangan; kuota harian tetap berlaku. Jangan menaruh secret dalam VITE_.

## Migrasi dan backup

Migration files di supabase/migrations memakai versi yang sama dengan migration history cloud. schema.sql dan backend.sql adalah salinan SQL untuk dibaca; jangan jalankan ulang pada database yang sudah dimigrasikan.

Satu metadata pengguna, Aerox, dipindahkan dari data/ setelah JSON dan hash diverifikasi:
0xfefe597377ba914cf6b14cd974516b42c1b775e5ba275be87d556929aea03366.
Kuota upload pengguna terkait juga dipertahankan. Dua metadata fixture EVM tidak dipindahkan. File sumber tetap ada. Sesi lama tidak dimigrasikan; pengguna melakukan verifikasi wallet kembali.

URI lama di blockchain tetap tidak berubah. Frontend sekarang mengambil salinan metadata localhost dari Supabase berdasarkan digest on-chain, lalu memeriksa kecocokan hash. Ini membuat paspor Aerox #2 yang sudah dimigrasikan terbaca lintas perangkat. Sumber HTTPS lama yang tidak tersedia juga dapat memakai salinan tersebut; data dengan hash tidak cocok tetap ditolak. Membuka URI localhost lama secara langsung di luar aplikasi masih memerlukan host aslinya. Metadata baru memakai URI HTTPS Supabase.

Gunakan backup/export PostgreSQL untuk database baru. scripts/backup.js hanya mendukung arsip SQLite lama; jangan menganggapnya sebagai backup cloud. Jadwal backup otomatis cloud tidak dibuat oleh perubahan ini.

## Verifikasi

- Build produksi berhasil.
- 22 tes backend/kontrak termasuk tes handler Edge, validasi, signature, session hashing, replay, autentikasi AI, sanitasi error, relay dan pembacaan metadata hasil migrasi.
- 9 skenario browser offline termasuk transaksi EVM, wallet asing, guard kontrak lama, review Gemini dan mobile.
- SQL verify.sql dan verify-backend.sql menguji privileges, constraint, rollback kuota, deduplikasi dan replay; fixtures dibatalkan.
- API cloud diuji dengan signature wallet sementara: empat upload paralel menjadi satu baris dan satu hitungan kuota; dibaca langsung dari cloud serta relay lokal.
- Sesi wallet baru berhasil diuji langsung di cloud; akses AI tanpa sesi ditolak. Mode allowlist adapter juga tetap diuji untuk penggunaan terbatas.
- Fixture cloud dibersihkan setelah pemeriksaan; Aerox tetap ada.
- Security Advisor dan Performance Advisor tidak mengembalikan temuan pada pemeriksaan terakhir.

Tes otomatis Gemini menggunakan provider mock. Pengujian nyata dengan nota sintetis telah dilakukan: key diterima oleh endpoint daftar model, tetapi generateContent masih mengalami timeout/503. Backend mencoba ulang satu kali hanya untuk respons 503, dengan deadline total 45 detik. Tidak ada transaksi BOT publik dalam pekerjaan ini.
