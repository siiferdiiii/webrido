"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AffiliateSidebar from "@/components/AffiliateSidebar";
import { AuthProvider } from "@/context/AuthContext";
import { AffiliateAuthProvider } from "@/context/AffiliateAuthContext";
import { PrivacyProvider } from "@/context/PrivacyContext";
import { MobileNavProvider } from "@/context/MobileNavContext";
import { ReactNode } from "react";

const AUTH_PAGES = ["/login", "/register", "/affiliate/login", "/affiliate/setup"];
const PUBLIC_PAGES = ["/order", "/marketplace"];

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some(p => pathname === p || pathname.startsWith(p + "?"));
  const isPublicPage = PUBLIC_PAGES.some(p => pathname === p || pathname.startsWith(p + "/"));
  const isAffiliatePage = pathname === "/affiliate" || pathname.startsWith("/affiliate/");

  // Auth pages & public customer pages — no layout chrome
  if (isAuthPage || isPublicPage) {
    return <>{children}</>;
  }

  // Affiliate portal — different sidebar, different context
  if (isAffiliatePage) {
    return (
      <AffiliateAuthProvider>
        <div className="flex min-h-screen">
          <AffiliateSidebar />
          <main className="flex-1 lg:ml-[260px] ml-0 min-h-screen min-w-0">
            {children}
          </main>
        </div>
      </AffiliateAuthProvider>
    );
  }

  // Admin dashboard — existing layout
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
