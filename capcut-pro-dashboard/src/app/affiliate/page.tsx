"use client";

import { useState, useEffect } from "react";
import { useAffiliateAuth } from "@/context/AffiliateAuthContext";
import {
  Wallet,
  TrendingUp,
  Users,
  Coins,
  Loader2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  affiliate: {
    id: string;
    name: string;
    commissionRate: number;
    totalEarned: number;
    balance: number;
    _count: { referredUsers: number; commissions: number; withdrawals: number };
  };
  recentCommissions: {
    id: string;
    amount: number;
    createdAt: string;
    user?: { name: string } | null;
    transaction?: { productName: string | null; amount: number } | null;
  }[];
  monthlyStats: Record<string, number>;
}

export default function AffiliateDashboardPage() {
  const { user } = useAffiliateAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/affiliate-portal/dashboard")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  const aff = data?.affiliate;

  // Build chart bars from monthly stats
  const months = Object.entries(data?.monthlyStats || {}).slice(-6);
  const maxVal = Math.max(...months.map(([, v]) => v), 1);

  return (
    <div>
      {/* Topbar */}
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white">
          Selamat datang, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Pantau performa affiliate kamu di sini
        </p>
      </div>

      <div className="px-8 pb-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card stat-card emerald">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                <Wallet size={20} className="text-emerald-400" />
              </div>
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Saldo</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">Rp {fmt(Number(aff?.balance || 0))}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Tersedia untuk ditarik</p>
          </div>

          <div className="glass-card stat-card indigo">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
                <TrendingUp size={20} className="text-[#818cf8]" />
              </div>
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Total Earned</span>
            </div>
            <p className="text-2xl font-bold text-[#818cf8]">Rp {fmt(Number(aff?.totalEarned || 0))}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Sepanjang waktu</p>
          </div>

          <div className="glass-card stat-card cyan">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(34,211,238,0.15)" }}>
                <Users size={20} className="text-cyan-400" />
              </div>
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Referral</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400">{aff?._count?.referredUsers || 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total customer</p>
          </div>

          <div className="glass-card stat-card amber">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                <Coins size={20} className="text-amber-400" />
              </div>
              <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Komisi</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{aff?._count?.commissions || 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total transaksi komisi</p>
          </div>
        </div>

        {/* Chart + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Chart */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Komisi Bulanan</h3>
            {months.length > 0 ? (
              <div className="flex items-end gap-3 h-40">
                {months.map(([month, value]) => {
                  const pct = (value / maxVal) * 100;
                  const label = new Date(month + "-01").toLocaleDateString("id-ID", { month: "short" });
                  return (
                    <div key={month} className="flex flex-col items-center flex-1 gap-2">
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        {value > 0 ? `${Math.round(value / 1000)}k` : "0"}
                      </span>
                      <div
                        className="w-full rounded-t-lg transition-all duration-500"
                        style={{
                          height: `${Math.max(pct, 4)}%`,
                          background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
                          minHeight: "4px",
                        }}
                      />
                      <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-[var(--text-muted)]">
                Belum ada data komisi
              </div>
            )}
          </div>

          {/* Recent Commissions */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Komisi Terbaru</h3>
              <Link href="/affiliate/commissions" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                Lihat semua <ArrowRight size={12} />
              </Link>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {data?.recentCommissions?.length ? (
                data.recentCommissions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-xl transition-colors hover:bg-[rgba(16,185,129,0.04)]"
                    style={{ border: "1px solid var(--border-color)" }}
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-white truncate">{c.user?.name || "—"}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {c.transaction?.productName || "Transaksi"} • {new Date(c.createdAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-400 flex-shrink-0">
                      +Rp {fmt(Number(c.amount))}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-sm text-[var(--text-muted)]">
                  Belum ada komisi
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/affiliate/referrals" className="glass-card p-5 group hover:border-cyan-500/30 transition-all">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-cyan-400" />
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">Lihat Referral</p>
                <p className="text-xs text-[var(--text-muted)]">Cek customer dari link kamu</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-[var(--text-muted)] group-hover:text-cyan-400 transition-colors" />
            </div>
          </Link>

          <Link href="/affiliate/commissions" className="glass-card p-5 group hover:border-amber-500/30 transition-all">
            <div className="flex items-center gap-3">
              <Coins size={20} className="text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">Riwayat Komisi</p>
                <p className="text-xs text-[var(--text-muted)]">Detail komisi per transaksi</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-[var(--text-muted)] group-hover:text-amber-400 transition-colors" />
            </div>
          </Link>

          <Link href="/affiliate/payout" className="glass-card p-5 group hover:border-emerald-500/30 transition-all">
            <div className="flex items-center gap-3">
              <Wallet size={20} className="text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">Tarik Saldo</p>
                <p className="text-xs text-[var(--text-muted)]">DANA atau Transfer Bank</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-[var(--text-muted)] group-hover:text-emerald-400 transition-colors" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
