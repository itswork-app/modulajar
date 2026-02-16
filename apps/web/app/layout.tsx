import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Modulajar — Modul Ajar Siap Pakai",
  description: "Generate cepat modul ajar. PDF terproteksi + watermark. Verifikasi publik via PID/DID untuk transparansi pendidikan.",
  openGraph: {
    title: "Modulajar — Modul Ajar Siap Pakai",
    description: "Administrasi pendidikan jadi lebih mudah, cepat, dan terverifikasi.",
    url: "https://modulajar.app",
    siteName: "Modulajar",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
