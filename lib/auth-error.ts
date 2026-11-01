export function authErrorMessage(error: unknown, hostname = ""): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "auth/operation-not-allowed":
      return "Metode login ini belum diaktifkan di Firebase Authentication.";
    case "auth/email-already-in-use":
      return "Email sudah terdaftar. Silakan masuk atau atur ulang password.";
    case "auth/unauthorized-domain":
      return hostname
        ? `Login Google belum diizinkan dari ${hostname}. Tambahkan domain ini di Firebase Authentication → Settings → Authorized domains.`
        : "Domain aplikasi belum ditambahkan ke Authorized domains Firebase.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba kembali beberapa saat lagi.";
    case "auth/popup-closed-by-user":
      return "Login Google dibatalkan.";
    case "auth/popup-blocked":
      return "Popup Google diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.";
    case "auth/unauthorized-continue-uri":
      return "Alamat tujuan email belum diizinkan di Firebase Authentication.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Email atau password tidak cocok.";
    case "auth/user-disabled":
      return "Akun ini sedang dinonaktifkan. Hubungi admin toko.";
    case "auth/network-request-failed":
      return "Koneksi ke layanan login terputus. Periksa internet lalu coba lagi.";
    case "auth/invalid-api-key":
      return "Konfigurasi Firebase aplikasi belum valid.";
    default:
      return "Login belum berhasil. Coba lagi atau atur ulang password.";
  }
}
