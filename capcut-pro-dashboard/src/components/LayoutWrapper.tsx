"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { AuthProvider } from "@/context/AuthContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { MobileNavProvider } from "@/context/MobileNavContext";
import { ReactNode } from "react";

const AUTH_PAGES = ["/login", "/register"];

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
