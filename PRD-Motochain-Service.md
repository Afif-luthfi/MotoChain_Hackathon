# PRD Motochain Service
Versi 2.0 · 24 September 2026
Perubahan disetujui pengguna: satu akun pemilik, tanpa ruang mekanik; foto nota hanya dibaca Gemini dan tidak disimpan.

## 1. Ringkasan produk
Motochain Service adalah buku servis motor yang dikelola pemilik. Pemilik mengunggah nota untuk dibaca Gemini, meninjau hasilnya dan menyimpan catatan melalui satu dompet. Paspor publik menampilkan riwayat dan bukti integritas blockchain.

## 2. Masalah yang diselesaikan
Riwayat servis tersebar pada nota dan sulit diperiksa kembali. Pergantian akun dan persetujuan mekanik membuat demo serta penggunaan awal terlalu rumit. Produk memusatkan riwayat tanpa mewajibkan bengkel memiliki dompet.

## 3. Pengguna sasaran
Pemilik motor sebagai pencatat; calon pembeli atau pembaca paspor sebagai pengunjung. Bengkel tidak mempunyai ruang kerja atau kewenangan dalam versi ini.

## 4. Tujuan dan ukuran keberhasilan
Pemilik dapat mendaftarkan motor, membaca nota, memperbaiki hasil dan menyimpan servis tanpa berganti akun. Catatan langsung terbaca setelah transaksi berhasil. Dompet lain tidak dapat menambah catatan motor tersebut. Pengunjung dapat memeriksa catatan tanpa login.

## 5. Lingkup produk
Registrasi motor, daftar motor milik dompet aktif, Gemini foto/teks, formulir yang dapat diperiksa, penyimpanan metadata dan hash, riwayat, paspor publik dan QR, pengaturan BOT Testnet dan Mainnet. Tidak ada mode demo lokal.
Foto dan teks sumber tidak disimpan. Manual entry tersedia jika AI gagal. Tidak mencakup ruang mekanik, pengaturan izin, antrian persetujuan, perpindahan kepemilikan, koreksi record atau migrasi otomatis.

## 6. Nilai pembeda
Nota membantu pemilik mengisi riwayat tanpa mengetik seluruh detail. Blockchain mencatat alamat pencatat dan sidik digital isian. Pemilik memakai satu akun dari awal sampai selesai.

## 7. Alur pengguna
Hubungkan dompet pemilik dan daftarkan motor melalui Garasi Saya. Pilih Tambah Catatan Servis pada navbar, pilih motor, unggah foto atau tempel nota, setujui pengiriman ke Gemini, tinjau draf, terapkan, lengkapi isian, periksa dan simpan. Tanda tangan metadata dan transaksi memakai akun yang sama. Setelah tersimpan, aplikasi membuka informasi dan riwayat motor terkait.

## 8. Kebutuhan fungsional dan kriteria penerimaan
- Hanya pemilik terdaftar dapat memanggil submitService untuk motornya.
- Gemini tidak boleh mengirim transaksi; penerapan draf memerlukan tinjauan eksplisit.
- Informasi yang tidak terbaca tidak boleh diisi dengan tebakan.
- Pemeriksaan tanggal, odometer dan isian wajib terjadi sebelum penyimpanan.
- Foto dan teks sumber tidak boleh masuk metadata publik.
- Dompet berubah, metadata rusak, saldo kurang dan pembatalan memiliki pesan yang dapat ditindaklanjuti.
- Kontrak lama ditolak untuk penulisan sebelum upload metadata; pembacaan tetap tersedia.

## 9. Halaman dan informasi utama
Navbar menyediakan Garasi Saya dan Tambah Catatan Servis. Garasi menampilkan daftar motor; setiap motor membuka informasi dan riwayat servisnya. Halaman Tambah Catatan Servis menyediakan pilihan motor dan formulir nota/Gemini. Tidak ada halaman mekanik atau pemilihan peran demo. Registrasi, panduan dan pengaturan jaringan tetap tersedia. Tautan paspor membuka informasi motor; tindakan menambah catatan hanya tersedia untuk pemilik.

## 10. Data dan peran blockchain
Motor: owner, digest, URI metadata dan waktu registrasi. Catatan: motorId, issuer, digest, URI dan waktu pencatatan. Isian publik: tanggal, odometer, keluhan, pekerjaan, komponen.
Kontrak v2 memiliki WORKFLOW_VERSION=2 dan onlyOwner pada submitService. Layout tuple Record dipertahankan untuk membaca versi lama; status 1 pada v2 berarti tersimpan langsung, bukan persetujuan dua pihak. Tidak ada setMechanic atau decideService.
Metadata disimpan pada server content-addressed dengan tanda tangan wallet. Foto tidak menjadi bukti tersimpan.
Implementasi penyimpanan diperbarui 25 September 2026: metadata, challenge wallet, hash sesi dan kuota berada di PostgreSQL Supabase melalui Edge Function. URL metadata baru memakai HTTPS Supabase. Kepemilikan dan hubungan riwayat tetap bersumber dari BOT Chain.

## 11. Aturan status dan kepercayaan
Alur baru: draf lokal, diperiksa, transaksi menunggu, tersimpan. UI menggunakan Dicatat pemilik. Gemini bukan pemeriksa keaslian nota; blockchain bukan bukti pekerjaan fisik benar. Catatan lama ditampilkan dengan label status historis versi 1.

## 12. Kebutuhan nonfungsional
Responsif desktop/ponsel, kontrol berlabel dan fokus keyboard, keutuhan metadata diverifikasi, API key hanya server, kuota AI dan batas ukuran gambar, penyimpanan permanen dan HTTPS untuk publik. Hash tidak memulihkan data yang hilang.

## 13. Skenario demo utama
Buka motor contoh, tempel atau unggah nota sintetis, baca melalui Gemini, tinjau dan terapkan draf, lengkapi formulir, simpan, lihat riwayat langsung bertambah. Tunjukkan QR dan label pencatat. Aplikasi hanya menampilkan data dari jaringan BOT; contoh pengujian hanya berada di test harness. Uji blockchain menggunakan akun pemilik yang sama.

## 14. Risiko dan mitigasi
AI salah baca: tinjau dan edit sebelum menyimpan. Pernyataan pemilik salah: label sumber jelas, tanpa klaim verifikasi bengkel. Data pribadi: samarkan nota sebelum dikirim. Kontrak v1: tampilkan petunjuk deploy ulang dan blokir penulisan. Metadata hilang: disk permanen dan backup. Gangguan Gemini: isi manual tetap tersedia.

## 15. Urutan implementasi
Kontrak v2 dan pembatasan pemilik; integrasi wallet serta pemeriksaan versi; halaman terpadu; Gemini dan tinjauan; pengujian demo, EVM dan UI; deploy v2; validasi dari URL publik.

## 16. Definition of Done
Implementasi lokal harus lolos build, tes otorisasi kontrak, tes metadata/AI dan browser satu akun. Foto sumber tidak tersimpan. Ruang mekanik tidak tampil.
Deployment v2 testnet/mainnet, alamat explorer, hosting frontend/API, domain, repository, dan seluruh bukti submission hackathon harus dipenuhi terpisah. Perubahan alur tidak otomatis membuktikan kepatuhan kompetisi. Gunakan checklist docs/SUBMISSION.md dan guidebook panitia untuk persyaratan eksternal. Kontrak v2 Testnet telah diverifikasi pada 0x0D90E98C9Fc63FDb62843F546E578CF237d91FD9. Mainnet, hosting publik dan submission belum dinyatakan selesai.

## 17. Pengembangan setelah MVP
Koreksi berversi, perpindahan pengelola, peningkatan akurasi pembacaan nota dan backup ekspor. Verifikasi independen bengkel dapat dievaluasi kemudian tanpa menjadi syarat pencatatan pemilik.
