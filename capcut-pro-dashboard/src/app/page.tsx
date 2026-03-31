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
  ShoppingCart,
  DollarSign,
  UserPlus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ChartPoint {
  date: string;
  label: string;
  penjualan: number;
  omset: number;
  newUser: number;
}

interface ChartData {
  chartData: ChartPoint[];
  summary: { totalPenjualan: number; totalOmset: number; totalNewUser: number };
  range: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyShort(amount: number) {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}jt`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`;
  return `${amount}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "success": return <span className="badge badge-success">Sukses</span>;
    case "pending": return <span className="badge badge-warning">Pending</span>;
    case "failed": return <span className="badge badge-danger">Gagal</span>;
    default: return <span className="badge badge-neutral">{status || "-"}</span>;
  }
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function PenjualanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,17,30,0.97)",
      border: "1px solid rgba(99,102,241,0.3)",
      borderRadius: 12,
      padding: "10px 14px",
      backdropFilter: "blur(16px)",
    }}>
      <p style={{ color: "#818cf8", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "white", fontSize: 14, fontWeight: 700 }}>
        {payload[0]?.value} transaksi
      </p>
    </div>
  );
}

function OmsetTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,17,30,0.97)",
      border: "1px solid rgba(16,185,129,0.3)",
      borderRadius: 12,
      padding: "10px 14px",
      backdropFilter: "blur(16px)",
    }}>
      <p style={{ color: "#34d399", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "white", fontSize: 14, fontWeight: 700 }}>
        {formatCurrency(payload[0]?.value || 0)}
      </p>
    </div>
  );
}

function UserTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,17,30,0.97)",
      border: "1px solid rgba(34,211,238,0.3)",
      borderRadius: 12,
      padding: "10px 14px",
      backdropFilter: "blur(16px)",
    }}>
      <p style={{ color: "#22d3ee", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "white", fontSize: 14, fontWeight: 700 }}>
        +{payload[0]?.value} user baru
      </p>
    </div>
  );
}

// ─── Range Selector ───────────────────────────────────────────────────────────

const RANGES = [
  { value: "1m", label: "1 Bulan" },
  { value: "3m", label: "3 Bulan" },
  { value: "6m", label: "6 Bulan" },
  { value: "1y", label: "1 Tahun" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { maskEmail, maskPhone } = usePrivacy();

  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);

  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [range, setRange] = useState("3m");

  // Fetch stat cards
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch chart data
  useEffect(() => {
    setChartLoading(true);
    fetch(`/api/analytics/charts?range=${range}`)
      .then((r) => r.json())
      .then(setChartData)
      .catch(console.error)
      .finally(() => setChartLoading(false));
  }, [range]);

  const stats = [
    {
      label: "Total Transaksi",
      value: data?.totalTransactions?.toLocaleString("id-ID") || "0",
      icon: ArrowLeftRight,
      color: "#818cf8",
      bg: "rgba(99,102,241,0.12)",
    },
    {
      label: "Total Pelanggan",
      value: data?.totalUsers?.toLocaleString("id-ID") || "0",
      icon: Users,
      color: "#22d3ee",
      bg: "rgba(34,211,238,0.12)",
    },
    {
      label: "Stok Tersedia",
      value: data?.availableStock?.toLocaleString("id-ID") || "0",
      icon: Package,
      color: "#34d399",
      bg: "rgba(16,185,129,0.12)",
    },
    {
      label: "Pelanggan Aktif",
      value: data?.activeUsers?.toLocaleString("id-ID") || "0",
      icon: UserCheck,
      color: "#fbbf24",
      bg: "rgba(245,158,11,0.12)",
    },
  ];

  const LABEL_TICK_COUNT = chartData?.chartData?.length
    ? Math.max(1, Math.floor(chartData.chartData.length / (range === "1m" ? 6 : range === "3m" ? 8 : 8)))
    : 6;

  const filteredLabels = (chartData?.chartData || []).filter(
    (_, i) => i % LABEL_TICK_COUNT === 0 || i === (chartData?.chartData?.length || 1) - 1
  );
  const labelSet = new Set(filteredLabels.map((d) => d.label));

  return (
    <>
      <Topbar title="Dashboard" subtitle="Ringkasan overview bisnis CapCut Pro" />

      <div className="px-4 md:px-8 pb-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#818cf8]" />
            <span className="ml-3 text-[var(--text-secondary)]">Memuat data...</span>
          </div>
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="glass-card"
                  style={{ padding: "20px 24px" }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: stat.bg }}
                    >
                      <stat.icon size={20} style={{ color: stat.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* ════════════════════════════════
                GRAFIK SECTION
            ════════════════════════════════ */}
            <div className="glass-card" style={{ padding: "24px 28px" }}>
              {/* Header + Range Selector */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-white text-base">Tren Performa Bisnis</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Penjualan, omset, dan penambahan pelanggan
                  </p>
                </div>
                {/* Range pills */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {RANGES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRange(r.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: range === r.value ? "rgba(129,140,248,0.2)" : "transparent",
                        color: range === r.value ? "#818cf8" : "var(--text-muted)",
                        border: range === r.value ? "1px solid rgba(129,140,248,0.4)" : "1px solid transparent",
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {chartLoading ? (
                <div className="flex items-center justify-center" style={{ height: 400 }}>
                  <Loader2 size={28} className="animate-spin text-[#818cf8]" />
                  <span className="ml-2 text-[var(--text-secondary)] text-sm">Memuat grafik...</span>
                </div>
              ) : (
                <>
                  {/* Summary badges */}
                  {chartData?.summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <div className="rounded-xl px-4 py-3" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingCart size={13} style={{ color: "#818cf8" }} />
                          <span className="text-xs text-[var(--text-muted)]">Total Penjualan</span>
                        </div>
                        <p className="text-xl font-bold text-white">{chartData.summary.totalPenjualan.toLocaleString("id-ID")}</p>
                        <p className="text-xs text-[var(--text-muted)]">transaksi sukses</p>
                      </div>
                      <div className="rounded-xl px-4 py-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign size={13} style={{ color: "#34d399" }} />
                          <span className="text-xs text-[var(--text-muted)]">Total Omset</span>
                        </div>
                        <p className="text-xl font-bold text-white">{formatCurrency(chartData.summary.totalOmset)}</p>
                        <p className="text-xs text-[var(--text-muted)]">pendapatan kotor</p>
                      </div>
                      <div className="rounded-xl px-4 py-3" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <UserPlus size={13} style={{ color: "#22d3ee" }} />
                          <span className="text-xs text-[var(--text-muted)]">User Baru</span>
                        </div>
                        <p className="text-xl font-bold text-white">{chartData.summary.totalNewUser.toLocaleString("id-ID")}</p>
                        <p className="text-xs text-[var(--text-muted)]">pelanggan bergabung</p>
                      </div>
                    </div>
                  )}

                  {/* ── Chart 1: Grafik Penjualan (Bar) ── */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#818cf8" }} />
                      <span className="text-sm font-semibold text-white">Grafik Penjualan</span>
                      <span className="text-xs text-[var(--text-muted)]">(jumlah transaksi per periode)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData?.chartData || []} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          tickFormatter={(v) => labelSet.has(v) ? v : ""}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<PenjualanTooltip />} />
                        <Bar dataKey="penjualan" fill="url(#barGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ── Chart 2: Grafik Omset (Area) ── */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#34d399" }} />
                      <span className="text-sm font-semibold text-white">Grafik Omset</span>
                      <span className="text-xs text-[var(--text-muted)]">(total revenue per periode)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={chartData?.chartData || []} margin={{ top: 4, right: 4, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          tickFormatter={(v) => labelSet.has(v) ? v : ""}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={formatCurrencyShort}
                        />
                        <Tooltip content={<OmsetTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="omset"
                          stroke="#34d399"
                          strokeWidth={2}
                          fill="url(#areaGrad)"
                          dot={false}
                          activeDot={{ r: 5, fill: "#34d399", stroke: "rgba(0,0,0,0.3)", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ── Chart 3: Grafik User Baru (Line) ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#22d3ee" }} />
                      <span className="text-sm font-semibold text-white">Grafik Penambahan Pelanggan</span>
                      <span className="text-xs text-[var(--text-muted)]">(user baru per periode)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData?.chartData || []} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <defs>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                              <feMergeNode in="coloredBlur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                          tickFormatter={(v) => labelSet.has(v) ? v : ""}
                        />
                        <YAxis
                          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<UserTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="newUser"
                          stroke="#22d3ee"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "#22d3ee", stroke: "rgba(0,0,0,0.3)", strokeWidth: 2 }}
                          filter="url(#glow)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            {/* ── Tabel & Expiring ── */}
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
