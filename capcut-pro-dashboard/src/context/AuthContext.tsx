"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { PermissionKey } from "@/lib/auth";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "developer" | "admin";
  status: string;
  permissions: Record<string, boolean> | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isDeveloper: boolean;
  hasPermission: (key: PermissionKey) => boolean;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDeveloper: false,
  hasPermission: () => false,
  logout: async () => {},
  refetch: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setUser(json.user || null);
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
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  };

  const hasPermission = (key: PermissionKey): boolean => {
    if (!user) return false;
    if (user.role === "developer") return true;
    return user.permissions?.[key] === true;
  };

  const isDeveloper = user?.role === "developer";

  return (
    <AuthContext.Provider value={{ user, loading, isDeveloper, hasPermission, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
