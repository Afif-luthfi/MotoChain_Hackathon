# Pemeriksaan antarmuka ruang mekanik
Tanggal: 24 September 2026. Cakupan: perubahan ruang mekanik, navigasi peran, dan formulir izin.
Arah: meja penerimaan bengkel dalam bahasa visual buku servis, mengikuti DESIGN.md. ENERGY 2 / RHYTHM 3 / MOTION 1.

## Hard Gate
- R-02 PASS: salinan baru tidak memakai em dash.
- R-03 PASS: pemeriksaan scrollWidth pada 390px lolos; screenshot mobile diperiksa.
- R-17 PASS: tidak ada statistik pemasaran; nomor paspor dan catatan berasal dari data aplikasi.
- R-18 PASS: tidak ada testimonial.
- R-23 PASS: pemisahan navigasi mengikuti permintaan pengguna; tidak menambah aset visual.
- R-24 PASS: navigasi garasi dan ruang mekanik memiliki rute yang dirender.
- R-25 PASS: rasio teks utama 12.93:1, teks sekunder 5.37:1, tombol 6.25:1, panel izin 11.67:1.
- R-26 PASS: pencarian, tautan paspor, pengajuan, salin izin dan periksa ulang memiliki handler; diuji di browser.
- R-27 PASS: komponen menyediakan loading, daftar kosong, motor tidak ditemukan, alamat tanpa izin, dan error.
- R-28 PASS: tidak menambah FAQ.
- R-32 PASS: input berlabel, kontrol HTML native, outline focus-visible; pengujian keyboard aplikasi lolos.
- R-33 PASS: komponen ditulis sebagai sumber JSX/CSS; edit sumber menggunakan patch.
- R-34 PASS: tidak ada toggle tema; tema terang mengikuti DESIGN.md.
- R-35 PASS: build produksi dan sepuluh skenario browser lolos, termasuk transaksi EVM lokal.
- R-36 PASS: daftar browser dilabeli sebagai riwayat lokal, bukan daftar global blockchain.
- R-37 PASS: arah dan dial mengikuti DESIGN.md yang dipilih sesuai persetujuan pengguna.
- R-38 PASS: contoh motor diberi label Demo lokal; tidak menambah klaim pelanggan nyata.

## Purpose Gate
- R-01 PASS: tidak ada gradient atau glow baru.
- R-04 PASS: tidak menambah ikon dekoratif.
- R-06 PASS: heading Georgia meneruskan identitas buku servis; label mewarisi sistem tipografi.
- R-07 PASS: garis memisahkan pencarian dan catatan; tidak ada grid dekoratif.
- R-08 PASS: tidak menambah panah dekoratif.
- R-09 PASS: status berupa teks faktual; tidak ada badge promosi.
- R-10 PASS: tidak ada glassmorphism.
- R-12 PASS: tidak ada bayangan kartu.
- R-13 PASS: tidak ada glow.
- R-14 PASS: daftar pelanggan dan detail pekerjaan memiliki hierarki berbeda sesuai fungsi.
- R-19 PASS: tidak menambah animasi; hover/focus singkat mengikuti MOTION 1.
- R-22 PASS: tidak menambah ilustrasi.

## Liveliness
- Dials PASS: ENERGY 2 / RHYTHM 3 / MOTION 1 tercantum di DESIGN.md.
- Consistency PASS: judul, pencarian, daftar pelanggan, panel izin dan ledger menggunakan ukuran dan ruang berbeda.
- Focal point PASS: judul ruang mekanik dan tindakan Catat servis menjadi fokus.
- Whitespace PASS: 48px memisahkan daftar dengan pekerjaan; 38px memisahkan ledger.
- Accent PASS: warna bata menandai tindakan; hijau menunjukkan akses aktif dan pelanggan terpilih.
- Identity PASS: Georgia, kertas hangat dan baris ledger meneruskan buku servis.
- Design read PASS: meneruskan arah desain proyek yang sudah ditetapkan sebelum implementasi.

## Craftsmanship
- C-1 PASS: kolom pelanggan mendukung pemilihan motor; panel kanan mendukung pekerjaan.
- C-2 PASS: seluruh kontrol baru memiliki perilaku nyata dan pengujian.
- C-3 PASS: setiap bagian mendukung penerimaan, izin atau pelacakan servis.
- C-4 PASS: desktop 1440px dan ponsel 390px diperiksa; kondisi gagal dan akses dicabut diuji.
- C-5 PASS: tidak ada klaim pelanggan, statistik atau testimonial buatan.
- R-05 PASS: susunan berangkat dari alur bengkel, dengan pencarian, daftar dan ledger.
- R-11 PASS: menggunakan radius input 3px/tombol 4px yang sudah ada, tanpa bentuk pill.
- R-15 PASS: CTA spesifik: Buka motor pelanggan, Catat servis, Salin tautan izin.
- R-16 PASS: tidak menambah buzzword pemasaran.
- R-20 PASS: paspor motor, izin pemilik dan ledger servis mempertahankan identitas produk.
- R-21 PASS: tema terang untuk pembacaan di bengkel mengikuti alasan DESIGN.md.
- R-29 PASS: mempertahankan kertas, charcoal, bata dan hijau status.
- R-30 PASS: tidak menyalin antarmuka produk lain.
- R-31 PASS: palet/typography mengikuti buku servis; susunan mengikuti pemilihan pelanggan lalu pekerjaan.

Bukti: tests/browser/workshop.spec.js, app.spec.js, chain.spec.js, ai.spec.js; docs/screenshots/workshop-desktop.png dan workshop-mobile.png. Uji blockchain memakai EVM lokal. Bukan bukti deployment BOT publik.
