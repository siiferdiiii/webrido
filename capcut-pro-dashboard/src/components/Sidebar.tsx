"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Package,
  ShieldCheck,
  MessageSquare,
  Settings,
  Scissors,
  CalendarClock,
  UserPlus,
  RefreshCw,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { href: "/users", label: "Pelanggan", icon: Users },
  { href: "/stock", label: "Stok Akun", icon: Package },
  { href: "/warranty", label: "Klaim Garansi", icon: ShieldCheck },
  { href: "/messages", label: "Riwayat Pesan", icon: MessageSquare },
];

const newItems = [
  { href: "/followup", label: "Follow-Up", icon: CalendarClock },
  { href: "/affiliates", label: "Affiliate", icon: UserPlus },
  { href: "/retention", label: "Analisis Retensi", icon: RefreshCw },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar fixed top-0 left-0 h-screen w-[260px] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[rgba(99,102,241,0.15)]">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--gradient-primary)" }}>
          <Scissors size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">CapCut Pro</h1>
          <p className="text-[11px] text-[var(--text-muted)]">Management Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 mb-3">
          Menu Utama
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? "active" : ""}`}>
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}

        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-4 mb-3 mt-6">
          Marketing
        </p>
        {newItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? "active" : ""}`}>
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[rgba(99,102,241,0.15)]">
        <Link href="/settings" className="sidebar-link">
          <Settings size={18} />
          Pengaturan
        </Link>
      </div>
    </aside>
  );
}
