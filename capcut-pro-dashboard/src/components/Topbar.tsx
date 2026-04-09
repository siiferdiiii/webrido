"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { Bell, Eye, EyeOff, Menu, LogOut, Shield, User, ChevronDown } from "lucide-react";
import { usePrivacy } from "@/context/PrivacyContext";
import { useMobileNav } from "@/context/MobileNavContext";
import { useAuth } from "@/context/AuthContext";

interface TopbarProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function Topbar({ title, subtitle, children }: TopbarProps) {
  const { isPrivate, toggle } = usePrivacy();
  const { open } = useMobileNav();
  const { user, logout, isDeveloper } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUserMenu) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button onClick={open} className="lg:hidden btn-icon flex-shrink-0" aria-label="Buka menu">
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <h2 className="text-base md:text-xl font-bold text-white leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5 hidden sm:block">{subtitle}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 ml-1 flex-shrink-0">{children}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Privacy Toggle */}
        <button
          onClick={toggle}
          className={`btn-icon relative transition-colors ${isPrivate ? "text-amber-400" : "text-[var(--text-muted)]"}`}
          title={isPrivate ? "Mode Privasi Aktif" : "Sembunyikan data sensitif"}
        >
          {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
          {isPrivate && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />}
        </button>

        {/* Notifications */}
        <button className="btn-icon relative">
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: "var(--gradient-danger)" }}>
            3
          </span>
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(p => !p)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all hover:bg-white/5"
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: isDeveloper ? "linear-gradient(135deg,#f59e0b,#f97316)" : "var(--gradient-primary)" }}
            >
              {initials}
            </div>
            {/* Name + role — md+ only */}
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.name || "..."}</p>
              <div className="flex items-center gap-1">
                {isDeveloper
                  ? <><Shield size={9} className="text-amber-400" /><span className="text-[10px] text-amber-400 font-medium">Developer</span></>
                  : <><User size={9} className="text-[#818cf8]" /><span className="text-[10px] text-[#818cf8] font-medium">Admin</span></>
                }
              </div>
            </div>
            <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform hidden md:block ${showUserMenu ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden shadow-2xl z-50"
              style={{ background: "rgba(15,17,30,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  {isDeveloper
                    ? <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5"><Shield size={9} /> Developer</span>
                    : <span className="text-[10px] font-bold text-[#818cf8] flex items-center gap-0.5"><User size={9} /> Admin</span>
                  }
                </div>
              </div>
              {/* Logout */}
              <button
                onClick={() => { setShowUserMenu(false); logout(); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
              >
                <LogOut size={15} />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
