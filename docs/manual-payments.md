# Pembayaran transfer manual

Pilihan pembayaran tersedia setelah pesanan web atau transaksi POS tersimpan. QRIS otomatis berlabel **Segera hadir** selama `MIDTRANS_QRIS_ENABLED` belum bernilai `true`. Transfer bank tetap tersedia tanpa akun Midtrans.

## Pengaturan oleh owner dan admin

1. Masuk ke `/dashboard` menggunakan email dan password owner/admin.
2. Pilih workspace cabang yang sesuai, lalu buka **Pembayaran**.
3. Isi nama bank, nomor rekening, dan nama pemilik rekening. Nilai awal nama bank adalah BCA, sedangkan nomor dan pemilik rekening sengaja dikosongkan.
4. Simpan rekening terlebih dahulu. Unggah gambar QR toko bila diperlukan. JPG, PNG, dan WebP diproses menjadi JPEG sebelum disimpan ke bucket Supabase privat yang sudah dipakai aplikasi.
5. Pastikan nomor rekening, pemilik, dan QR benar sebelum menerima pembayaran. Jika identitas rekening diubah, unggah ulang QR yang sesuai dengan rekening baru.

Pengaturan tersimpan per cabang. Staf dapat memproses pesanan dan memeriksa pembayaran, tetapi tidak dapat mengubah rekening atau gambar QR. Pembatasan ini diperiksa di server, bukan hanya melalui tampilan menu.

Ketika belum ada QR toko, pelanggan melihat ilustrasi QR dengan keterangan **Contoh QR · belum dapat dibayar**. Ilustrasi tersebut tidak dapat dipakai untuk pembayaran. Nomor rekening asli harus diisi oleh owner/admin sebelum transfer dapat diajukan.

## Pelanggan dan POS

1. Selesaikan form pesanan dan titik penjemputan, atau buat transaksi langsung di POS.
2. Pilih **BCA manual** atau nama bank yang sudah diatur toko. Rekening dan tombol salin muncul bersama QR opsional.
3. Untuk pesanan jemput, tunggu toko menyimpan berat aktual dan ongkir. POS sudah memakai berat aktual dan ongkir nol ketika pesanan dibuat.
4. Transfer sesuai tagihan final. Unggah foto atau tangkapan layar bukti pembayaran.
5. Setelah unggahan selesai, tekan **Saya sudah transfer · Ajukan konfirmasi**.
6. Status berubah menjadi **Perlu konfirmasi**, dengan warna amber. Mengunggah bukti atau menekan tombol ini tidak langsung menjadikan order lunas.

Pelanggan tetap dapat membuka detail pembayaran dari halaman tracking. Rekening yang dipilih disimpan sebagai snapshot agar instruksi pembayaran tidak berubah diam-diam ketika toko mengedit rekeningnya. Gambar QR yang sudah dipilih pesanan juga memakai versi yang sama.

## Pemeriksaan oleh toko

Dashboard menampilkan banner jumlah pembayaran yang perlu diperiksa, filter **Perlu konfirmasi**, dan penanda amber pada baris pesanan. Buka detail pesanan untuk melihat bukti.

- **Konfirmasi pembayaran:** cocokkan nominal, nama rekening, dan mutasi dana masuk. Setelah disetujui, status berubah menjadi **Lunas** dengan warna hijau dan dihitung sebagai penjualan terbayar.
- **Tolak bukti:** isi alasan yang jelas. Customer melihat alasan tersebut dan harus mengunggah bukti baru sebelum mengajukan ulang.

Selama bukti menunggu konfirmasi atau pembayaran sudah lunas, nominal tagihan dikunci. Status proses laundry tetap dapat diperbarui. Pengubahan field `paid` melalui form pesanan tidak dapat melewati prosedur pemeriksaan pembayaran.

Customer dan dashboard menerima perubahan melalui koneksi event, dengan pemeriksaan status berkala sebagai cadangan. Tab yang ditutup tidak membatalkan pengajuan pembayaran.

## Penyimpanan dan akses

Bukti transfer disimpan di Supabase privat. Akses gambar memerlukan akun pemilik pesanan, akun dashboard yang berwenang, atau link tracking privat pesanan tersebut. Jangan membagikan link tracking ke pihak lain karena link tersebut memberikan akses pembayaran pesanan itu.

Field publik pesanan hanya berisi ringkasan status dan versi bukti. Path penyimpanan, identitas pemeriksa, dan catatan internal tidak dikirim sebagai data tracking. Gambar QR bisnis bisa diakses publik untuk ditampilkan kepada customer, sementara bukti transfer tetap melalui pemeriksaan akses.

Tidak ada pemeriksaan mutasi BCA otomatis. Toko tetap bertanggung jawab mencocokkan dana masuk sebelum mengonfirmasi pembayaran.

## Aktifkan QRIS otomatis setelah verifikasi

Ikuti [panduan Midtrans](midtrans-qris.md). Aktifkan `MIDTRANS_QRIS_ENABLED=true` hanya setelah akun, Server Key, kanal QRIS, dan webhook sudah siap serta sudah diuji. Transfer manual dan QRIS tidak dapat diproses bersamaan pada tagihan yang sama ketika salah satunya sedang aktif atau sudah lunas.
