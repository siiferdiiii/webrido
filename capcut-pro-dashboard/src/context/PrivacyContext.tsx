// Privacy Context - global state untuk mode sembunyikan data sensitif
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PrivacyContextType {
  isPrivate: boolean;
  toggle: () => void;
  maskEmail: (email: string | null | undefined) => string;
  maskPhone: (phone: string | null | undefined) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isPrivate: false,
  toggle: () => {},
  maskEmail: (e) => e || "-",
  maskPhone: (p) => p || "-",
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("privacyMode");
    if (saved === "true") setIsPrivate(true);
  }, []);

  function toggle() {
    setIsPrivate((prev) => {
      localStorage.setItem("privacyMode", String(!prev));
      return !prev;
    });
  }

  function maskEmail(email: string | null | undefined): string {
    if (!email) return "-";
    if (!isPrivate) return email;
    const [local, domain] = email.split("@");
    if (!domain) return email;
    const visible = local.substring(0, 2);
    return `${visible}***@${domain}`;
  }

  function maskPhone(phone: string | null | undefined): string {
    if (!phone) return "-";
    if (!isPrivate) return phone;
    const str = String(phone);
    if (str.length <= 4) return "***";
    const prefix = str.substring(0, 4);
    const suffix = str.slice(-1);
    return `${prefix}***${suffix}`;
  }

  return (
    <PrivacyContext.Provider value={{ isPrivate, toggle, maskEmail, maskPhone }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
