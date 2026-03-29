"use client";

import { ReactNode } from "react";
import { Bell, Search, Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/context/PrivacyContext";

interface TopbarProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function Topbar({ title, subtitle, children }: TopbarProps) {
  const { isPrivate, toggle } = usePrivacy();

  return (
    <header className="flex items-center justify-between px-8 py-5">
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 ml-2">
            {children}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="search-box hidden md:block">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Cari cepat..."
            className="form-input w-[220px] !pl-10 !py-2 text-sm"
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
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: "var(--gradient-primary)" }}>
          R
        </div>
      </div>
    </header>
  );
}
