"use client";

import { useState, useEffect } from "react";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Users,
  ArrowLeftRight,
  Package,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  Loader2,
} from "lucide-react";

interface StatData {
  totalTransactions: number;
  totalUsers: number;
  availableStock: number;
  activeUsers: number;
  recentTransactions: Array<{
    id: string;
    amount: number;
    status: string | null;
    purchaseDate: string | null;
    user: { name: string; email: string; whatsapp: string | null } | null;
  }>;
  expiringUsers: Array<{
    id: string;
    warrantyExpiredAt: string | null;
    user: { name: string; whatsapp: string | null; followUpStatus: string | null } | null;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "success": return <span className="badge badge-success">Sukses</span>;
    case "pending": return <span className="badge badge-warning">Pending</span>;
    case "failed": return <span className="badge badge-danger">Gagal</span>;
    default: return <span className="badge badge-neutral">{status || "-"}</span>;
  }
}

export default function DashboardPage() {
  const { maskEmail, maskPhone } = usePrivacy();
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "Total Transaksi",
      value: data?.totalTransactions?.toLocaleString("id-ID") || "0",
      icon: ArrowLeftRight,
      variant: "indigo" as const,
    },
    {
      label: "Total Pelanggan",
      value: data?.totalUsers?.toLocaleString("id-ID") || "0",
      icon: Users,
      variant: "cyan" as const,
    },
    {
      label: "Stok Tersedia",
      value: data?.availableStock?.toLocaleString("id-ID") || "0",
      icon: Package,
      variant: "emerald" as const,
    },
    {
      label: "Pelanggan Aktif",
      value: data?.activeUsers?.toLocaleString("id-ID") || "0",
      icon: UserCheck,
      variant: "amber" as const,
    },
  ];

  return (
    <>
      <Topbar title="Dashboard" subtitle="Ringkasan overview bisnis CapCut Pro" />

      <div className="px-8 pb-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#818cf8]" />
            <span className="ml-3 text-[var(--text-secondary)]">Memuat data...</span>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {stats.map((stat) => (
                <div key={stat.label} className={`glass-card stat-card ${stat.variant}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{
                        background: stat.variant === "indigo" ? "rgba(99,102,241,0.15)" :
                          stat.variant === "cyan" ? "rgba(34,211,238,0.15)" :
                          stat.variant === "emerald" ? "rgba(16,185,129,0.15)" :
                          "rgba(245,158,11,0.15)"
                      }}>
                      <stat.icon size={20} style={{
                        color: stat.variant === "indigo" ? "#818cf8" :
                          stat.variant === "cyan" ? "#22d3ee" :
                          stat.variant === "emerald" ? "#34d399" :
                          "#fbbf24"
                      }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Recent Transactions */}
              <div className="xl:col-span-2 glass-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(99,102,241,0.1)]">
                  <h3 className="font-semibold text-white">Transaksi Terbaru</h3>
                  <a href="/transactions" className="text-sm text-[#818cf8] hover:text-[#a5b4fc] transition-colors">
                    Lihat Semua →
                  </a>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Pelanggan</th>
                        <th>Nominal</th>
                        <th>Tanggal</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.recentTransactions || []).length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-[var(--text-muted)]">Belum ada transaksi</td></tr>
                      ) : (
                        data?.recentTransactions.map((trx) => (
                          <tr key={trx.id}>
                            <td>
                              <div>
                                <p className="font-medium">{trx.user?.name || "-"}</p>
                                <p className="text-xs text-[var(--text-muted)]">{maskEmail(trx.user?.email)}</p>
                              </div>
                            </td>
                            <td className="font-semibold">{formatCurrency(Number(trx.amount))}</td>
                            <td className="text-[var(--text-secondary)]">{formatDate(trx.purchaseDate)}</td>
                            <td>{getStatusBadge(trx.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expiring Soon */}
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(99,102,241,0.1)]">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400" />
                    Segera Expired
                  </h3>
                </div>
                <div className="divide-y divide-[rgba(99,102,241,0.08)]">
                  {(data?.expiringUsers || []).length === 0 ? (
                    <p className="px-6 py-8 text-sm text-[var(--text-muted)] text-center">
                      Tidak ada yang segera expired
                    </p>
                  ) : (
                    data?.expiringUsers.map((item, idx) => (
                      <div key={idx} className="px-6 py-4 hover:bg-[rgba(99,102,241,0.04)] transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-white text-sm">{item.user?.name || "-"}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{maskPhone(item.user?.whatsapp)}</p>
                          </div>
                          <span className="badge badge-warning text-[11px]">{formatDate(item.warrantyExpiredAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
