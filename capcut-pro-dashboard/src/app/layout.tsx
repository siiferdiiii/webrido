import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { PrivacyProvider } from "@/context/PrivacyContext";

export const metadata: Metadata = {
  title: "CapCut Pro Dashboard",
  description: "Dashboard Pengelola Akun CapCut Pro - Manajemen Transaksi, User, dan Stok",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PrivacyProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-[260px] min-h-screen">
              {children}
            </main>
          </div>
        </PrivacyProvider>
      </body>
    </html>
  );
}
