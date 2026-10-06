import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
export const metadata: Metadata = {
  title: "D’Fable — Laundry Studio",
  description:
    "Cucian bersih, hari lebih ringan. Pesan layanan laundry dan pantau perjalanan pakaianmu.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
