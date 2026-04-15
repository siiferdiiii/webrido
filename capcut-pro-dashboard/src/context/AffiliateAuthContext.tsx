"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AffiliateUser {
  id: string;
  email: string;
  name: string;
  whatsapp: string | null;
  commissionRate: number;
  totalEarned: number;
  balance: number;
  status: string;
}

interface AffiliateAuthContextType {
  user: AffiliateUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AffiliateAuthContext = createContext<AffiliateAuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refetch: () => {},
});

export function AffiliateAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AffiliateUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate-portal/auth/me");
      if (res.ok) {
        const json = await res.json();
        setUser(json.affiliate || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const logout = async () => {
    await fetch("/api/affiliate-portal/auth/me", { method: "POST" });
    setUser(null);
    window.location.href = "/affiliate/login";
  };

  return (
    <AffiliateAuthContext.Provider value={{ user, loading, logout, refetch: fetchUser }}>
      {children}
    </AffiliateAuthContext.Provider>
  );
}

export function useAffiliateAuth() {
  return useContext(AffiliateAuthContext);
}
