# Alur pemilik versi 2

Pemilik memakai satu dompet untuk mendaftarkan motor dan menyimpan servis. Ruang mekanik, izin mekanik, pergantian peran, pengajuan dan persetujuan terpisah sudah dihapus.

## Menggunakan aplikasi

1. Buka Garasi Saya, pilih jaringan dan hubungkan dompet pemilik.
2. Daftarkan motor. Klik motor di garasi untuk membuka informasi dan riwayat servisnya.
3. Pilih Tambah Catatan Servis pada navbar, lalu pilih motor yang diservis. Unggah foto atau tempel teks nota pada asisten Gemini.
4. Setujui pengiriman ke Gemini. Periksa hasilnya dan tekan Terapkan ke formulir.
5. Lengkapi isian kosong. Tekan Periksa catatan, lalu Simpan catatan.
6. Setujui tanda tangan metadata dan transaksi blockchain melalui dompet yang sama.
7. Aplikasi kembali ke informasi motor tersebut. Catatan tampil di bagian Riwayat servis dengan label Dicatat pemilik.

Foto dan teks sumber nota tidak disimpan oleh aplikasi. Yang tersimpan hanya isian servis hasil pemeriksaan pemilik. Tidak ada klaim verifikasi bengkel atau keaslian nota oleh AI.

## Kontrak yang sudah dideploy sebelumnya

Kontrak versi 1 tetap menggunakan aturan lama. Alamat tersebut tidak dapat diperbarui dengan mengganti frontend. Aplikasi mempertahankan pembacaan paspor lama dan menolak penulisan ke kontrak lama.

Deploy file contracts/MotochainService.sol terbaru melalui Remix: compiler 0.8.30, optimizer 200, EVM Paris, Value 0, tanpa constructor argument. WORKFLOW_VERSION harus mengembalikan 2. Masukkan alamat baru di Jaringan. Jika alamat ditetapkan melalui VITE_TESTNET_CONTRACT atau VITE_MAINNET_CONTRACT, ubah konfigurasi itu dan build ulang.

Motor perlu didaftarkan kembali di kontrak baru. Simpan alamat dan tautan kontrak lama untuk mengakses riwayatnya; tidak ada migrasi otomatis atau penghapusan data lama.

## Jaringan dan batasan

Aplikasi hanya menyediakan BOT Testnet dan BOT Mainnet. Tidak ada mode demo lokal atau motor contoh. Pengaturan demo lama diarahkan ke Testnet; tautan paspor demo ditolak. Foto hanya dibaca selama sesi formulir dan tidak disimpan.

Untuk penggunaan lintas perangkat, deploy API metadata dengan HTTPS dan disk permanen sebelum menyimpan catatan on-chain.
