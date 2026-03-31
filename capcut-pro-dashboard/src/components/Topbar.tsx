"use client";

import { ReactNode } from "react";
import { Bell, Search, Eye, EyeOff, Menu } from "lucide-react";
import { usePrivacy } from "@/context/PrivacyContext";
import { useMobileNav } from "@/context/MobileNavContext";

interface TopbarProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function Topbar({ title, subtitle, children }: TopbarProps) {
  const { isPrivate, toggle } = usePrivacy();
  const { open } = useMobileNav();

  return (
    <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={open}
          className="lg:hidden btn-icon flex-shrink-0"
          aria-label="Buka menu"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <h2 className="text-base md:text-xl font-bold text-white leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5 hidden sm:block">{subtitle}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 ml-1 flex-shrink-0">
            {children}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Search — md+ only */}
        <div className="search-box hidden md:block">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Cari cepat..."
            className="form-input w-[200px] !pl-10 !py-2 text-sm"
          />
        </div>

        {/* Privacy Toggle */}
        <button
          onClick={toggle}
          className={`btn-icon relative transition-colors ${isPrivate ? "text-amber-400" : "text-[var(--text-muted)]"}`}
          title={isPrivate ? "Mode Privasi Aktif — Klik untuk tampilkan data" : "Sembunyikan data sensitif"}
        >
          {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
          {isPrivate && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
          )}
        </button>

        {/* Notifications */}
        <button className="btn-icon relative">
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ background: "var(--gradient-danger)" }}>
            3
          </span>
        </button>

        {/* Admin Avatar */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ background: "var(--gradient-primary)" }}>
          R
        </div>
      </div>
    </header>
  );
}
