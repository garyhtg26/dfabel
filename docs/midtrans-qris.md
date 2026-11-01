# Pembayaran QRIS D’Fable

D’Fable memakai Midtrans Core API untuk menampilkan QRIS dinamis langsung di web customer dan POS. Nominal dan nomor transaksi ditentukan server. Pembayaran asli baru tersedia setelah akun merchant disetujui dan kanal QRIS diaktifkan oleh Midtrans.

## Siapkan akun dan sandbox

1. Daftar akun atas nama pemilik atau badan usaha D’Fable di https://dashboard.midtrans.com/.
2. Pilih lingkungan **Sandbox**, lalu buka **Settings → Access Keys**. Nama menu dapat berubah mengikuti dashboard Midtrans.
3. Salin **Server Key**, bukan Client Key. Server Key sandbox diawali `SB-Mid-server-`. Isi variabel berikut di `.env.local`. Jangan mengirim Server Key melalui chat, memasukkannya ke komponen browser, atau melakukan commit `.env.local`.

```dotenv
MIDTRANS_SERVER_KEY=YOUR_SANDBOX_SERVER_KEY
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_QRIS_ENABLED=false
MIDTRANS_MERCHANT_ID=
```

`MIDTRANS_MERCHANT_ID` boleh dikosongkan. Jika diisi, gunakan Merchant ID asli dari akun dengan Server Key yang sama. Variabel ini menambahkan pemeriksaan identitas merchant. Client Key dan Snap JavaScript tidak diperlukan karena integrasi ini hanya menggunakan QRIS Core API dari server.

Selama verifikasi merchant belum selesai, biarkan `MIDTRANS_QRIS_ENABLED=false`. Customer dan POS tetap dapat memakai [transfer manual](manual-payments.md), sedangkan QRIS otomatis berlabel **Segera hadir**. Untuk menguji QRIS sandbox, aktifkan flag tersebut hanya pada lingkungan staging dengan Sandbox Server Key.

4. Restart server lokal yang kamu jalankan di VS Code setelah mengubah environment. Codex tidak perlu menjalankan server kedua.
5. Tambahkan variabel yang sama ke **Vercel → Project → Settings → Environment Variables** untuk lingkungan pengujian, lalu redeploy.
6. Atur **Payment Notification URL** di Midtrans ke URL HTTPS publik:

```text
https://DOMAIN-APLIKASI/api/payments/webhook
```

Endpoint harus bisa diakses Midtrans tanpa login, redirect, password deployment, atau Vercel Authentication. Permintaannya tetap diverifikasi oleh server. `localhost` dan `127.0.0.1` tidak bisa menerima webhook dari Midtrans. Gunakan deployment staging publik untuk pengujian webhook. Pemeriksaan status melalui API menjadi cadangan jika webhook terlambat.

## Alur customer dan kasir

1. Pesanan online dibuat dengan berat perkiraan dan ongkir belum dikonfirmasi.
2. Toko menyimpan berat aktual dan ongkir. Isi ongkir `0` untuk gratis atau ambil sendiri.
3. Customer membuka tracking, atau kasir membuka detail pesanan/POS, lalu memilih **Bayar QRIS**.
4. Server membuat satu QR untuk total final dengan masa berlaku 15 menit. QR dapat diunduh untuk diimpor dari galeri pada aplikasi pembayaran yang mendukung.
5. Customer membayar. Server memverifikasi transaksi Midtrans sebelum menandai order lunas.
6. Halaman pembayaran dan dashboard menerima pembaruan melalui koneksi event. Jika koneksi terputus, halaman menyambung kembali dan memeriksa status melalui API.

Selama transaksi berstatus dibuat, menunggu pembayaran, atau sudah lunas, nominal tagihan dikunci. Kasir dapat membatalkan QR yang belum dibayar sebelum mengubah tagihan. Konfirmasi pembatalan harus berasal dari Midtrans. Jam kedaluwarsa di browser tidak otomatis membuka kunci tagihan. Transaksi sukses tidak dapat dibatalkan sebagai cara menghapus status lunas.

Dalam mode QRIS aktif, status pembayaran dikonfirmasi gateway. Centang transfer manual tidak dipakai untuk mengubah pembayaran QRIS. Pesanan yang sebelumnya sudah lunas tetap tercatat dan tidak dibuatkan tagihan ulang.

## Pengujian sebelum produksi

- Gunakan Sandbox Midtrans dan simulator resminya, bukan aplikasi bank dengan uang asli.
- Uji customer yang menunggu konfirmasi berat, POS, QR aktif, QR kedaluwarsa, pembatalan, dan pembuatan QR ulang.
- Klik tombol bayar beberapa kali dan buka pesanan dari dua tab. Keduanya harus menunjuk transaksi yang sama selama QR masih aktif.
- Selesaikan transaksi sandbox dan pastikan customer serta dashboard berubah menjadi lunas tanpa refresh manual.
- Kirim ulang notifikasi sandbox. Total pembayaran tidak boleh tercatat dua kali atau kembali menjadi belum lunas.
- Uji tampilan mobile, unduh QR, berpindah aplikasi, dan kembali ke web.
- Periksa pembayaran sukses setelah halaman ditutup dan dibuka kembali. Pembayaran ditetapkan oleh server, bukan oleh keberadaan tab customer.
- Uji akun customer kedua dan token yang salah. Keduanya tidak boleh mengakses pembayaran pesanan orang lain.

Tes otomatis di repository memakai data dan provider palsu. Tes tersebut tidak membuktikan aktivasi merchant atau keberhasilan transaksi Midtrans langsung.

## Aktivasi produksi

Lengkapi dokumen usaha, rekening pencairan, dan persetujuan kanal QRIS pada Midtrans. Pastikan nama merchant yang muncul saat dipindai sesuai D’Fable. Gunakan **Production Server Key**, ubah `MIDTRANS_IS_PRODUCTION=true` dan `MIDTRANS_QRIS_ENABLED=true`, lalu atur Payment Notification URL produksi. Redeploy Vercel setelah mengganti environment. Pisahkan deployment dan data pengujian dari transaksi produksi.

Sebelum menerima customer, pemilik melakukan uji pembayaran produksi nominal kecil dan memeriksa catatan di dashboard Midtrans, D’Fable, serta jadwal pencairan. Jangan memakai simulator atau Sandbox Key pada transaksi asli.

## Biaya dan dana

Syarat merchant yang disetujui Midtrans menjadi acuan biaya. Periksa MDR sesuai kategori dan nominal transaksi, biaya tambahan per transaksi, biaya pencairan, minimum pencairan, serta syarat deposit atau saldo minimum. Integrasi API tidak menjamin merchant memperoleh tarif tertentu.

MDR 0% tidak selalu berarti seluruh layanan gateway dan pencairan gratis. Status pembayaran otomatis juga terpisah dari kapan dana tersedia di rekening bank.

Dokumentasi resmi:

- [QRIS Core API](https://docs.midtrans.com/reference/qris)
- [Notifikasi dan verifikasi](https://docs.midtrans.com/docs/https-notification-webhooks)
- [Biaya Midtrans](https://midtrans.com/id/biaya)
- [Informasi pencairan](https://docs.midtrans.com/docs/fund-withdrawal)
- [Tarif MDR Bank Indonesia](https://www.bi.go.id/id/publikasi/ruang-media/cerita-bi/pages/mdr-qris.aspx)
