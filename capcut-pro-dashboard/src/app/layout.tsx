import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { MobileNavProvider } from "@/context/MobileNavContext";

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <MobileNavProvider>
          <PrivacyProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 lg:ml-[260px] ml-0 min-h-screen min-w-0">
                {children}
              </main>
            </div>
          </PrivacyProvider>
        </MobileNavProvider>
      </body>
    </html>
  );
}
