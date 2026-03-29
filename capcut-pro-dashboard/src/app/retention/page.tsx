"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Search,
  Loader2,
  RefreshCw,
  Users,
  TrendingDown,
  CalendarDays,
  CheckCircle,
  XCircle,
  MessageCircle,
  Download,
} from "lucide-react";

interface CustomerRetention {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  status: "retained" | "churned";
  periodATransactions: number;
  periodAAmount: number;
  periodBTransactions: number;
  periodBAmount: number;
}

interface RetentionData {
  summary: { totalPeriodA: number; retained: number; churned: number; retentionRate: number };
  period: { a: { start: string; end: string }; b: { start: string; end: string } };
  customers: CustomerRetention[];
}

export default function RetentionPage() {
  const { maskPhone, maskEmail } = usePrivacy();
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Default filter dates
  const td = new Date();
  const todayStr = td.toISOString().split("T")[0];
  const firstDayThisMonth = new Date(td.getFullYear(), td.getMonth(), 1).toISOString().split("T")[0];
  const lastDayLastMonthObj = new Date(td.getFullYear(), td.getMonth(), 0);
  const lastDayLastMonth = lastDayLastMonthObj.toISOString().split("T")[0];
  const firstDayLastMonth = new Date(td.getFullYear(), td.getMonth() - 1, 1).toISOString().split("T")[0];

  const [startA, setStartA] = useState(firstDayLastMonth);
  const [endA, setEndA] = useState(lastDayLastMonth);
  const [startB, setStartB] = useState(firstDayThisMonth);
  const [endB, setEndB] = useState(todayStr);

  const fetchRetention = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startA) params.set("startA", `${startA}T00:00:00`);
    if (endA) params.set("endA", `${endA}T23:59:59`);
    if (startB) params.set("startB", `${startB}T00:00:00`);
    if (endB) params.set("endB", `${endB}T23:59:59`);
    
    try {
      const res = await fetch(`/api/analytics/retention?${params}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [startA, endA, startB, endB]);

  useEffect(() => { fetchRetention(); }, [fetchRetention]);

  // Buka chat WA format follow up repeat order
  const followUpWA = (cust: CustomerRetention) => {
    if (!cust.whatsapp) return;
    const phone = cust.whatsapp.replace(/^0/, "62").replace(/\D/g, "");
    const text = `Halo Kak ${cust.name || ""}, langganan CapCut Pro-nya mau diperpanjang? 😊`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const formatRp = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);

  const handleExportCSV = () => {
    if (!filteredCustomers.length) return;
    const headers = ["Nama", "Email", "WhatsApp", "Status", "Order Periode A", "Nominal Periode A", "Order Periode B", "Nominal Periode B"];
    const rows = filteredCustomers.map(c => [
      c.name,
      c.email,
      c.whatsapp || "-",
      c.status === "retained" ? "Repeat" : "Belum Repeat",
      c.periodATransactions,
      c.periodAAmount,
      c.periodBTransactions,
      c.periodBAmount,
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    a.download = `retensi_pelanggan_${statusFilter || "semua"}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCustomers = data?.customers.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.whatsapp?.toLowerCase().includes(q));
    }
    return true;
  }) || [];

  return (
    <div>
      <Topbar title="Analisis Retensi" subtitle="Lacak pelanggan yang repeat order (perpanjang) antar dua periode." />

      <div className="px-8 pb-8 space-y-5">
        
        {/* Date Filter Section */}
        <div className="glass-card p-4 flex flex-wrap lg:flex-nowrap items-end gap-6">
          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-1.5"><CalendarDays size={14} className="text-blue-400" /> Periode A (Lalu)</h4>
            <div className="flex items-center gap-2">
              <input type="date" className="form-input text-sm !py-1.5" value={startA} onChange={(e) => setStartA(e.target.value)} />
              <span className="text-[var(--text-muted)] text-sm">s/d</span>
              <input type="date" className="form-input text-sm !py-1.5" value={endA} onChange={(e) => setEndA(e.target.value)} />
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Pelanggan yang beli di periode ini...</p>
          </div>
          
          <div className="hidden lg:flex flex-col items-center justify-center text-[var(--text-muted)] mx-2 pb-5"><RefreshCw size={20} /></div>
          
          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-1.5"><CalendarDays size={14} className="text-green-400" /> Periode B (Sekarang)</h4>
            <div className="flex items-center gap-2">
              <input type="date" className="form-input text-sm !py-1.5" value={startB} onChange={(e) => setStartB(e.target.value)} />
              <span className="text-[var(--text-muted)] text-sm">s/d</span>
              <input type="date" className="form-input text-sm !py-1.5" value={endB} onChange={(e) => setEndB(e.target.value)} />
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">...apakah mereka beli lagi di periode ini?</p>
          </div>
          
          <button onClick={fetchRetention} className="btn-primary" style={{ height: 34 }}>
            Terapkan Filter
          </button>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--text-muted)] font-medium">Total Beli Periode A</p>
              <Users size={16} className="text-[var(--text-secondary)]" />
            </div>
            <p className="text-2xl font-bold text-white">{data?.summary.totalPeriodA || 0}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--text-muted)] font-medium">Repeat (Periode B)</p>
              <CheckCircle size={16} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400">{data?.summary.retained || 0}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--text-muted)] font-medium">Belum Repeat</p>
              <XCircle size={16} className="text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-rose-400">{data?.summary.churned || 0}</p>
          </div>
          <div className="glass-card p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--text-muted)] font-medium">Retensi (Repeat Rate)</p>
              <TrendingDown size={16} className="text-cyan-400" />
            </div>
            <p className="text-2xl font-bold text-cyan-400">{data?.summary.retentionRate || 0}%</p>
            {/* Progress bar background visual */}
            <div className="absolute bottom-0 left-0 h-1 bg-cyan-400/20 w-full" />
            <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 transition-all duration-1000" style={{ width: `${data?.summary.retentionRate || 0}%` }} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="search-box flex-1 max-w-sm">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Cari pelanggan..." className="form-input !pl-10 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-pills">
              {[
                { val: "", label: "Semua" },
                { val: "retained", label: "Sudah Repeat" },
                { val: "churned", label: "Belum Repeat" },
              ].map((s) => (
                <button key={s.val} className={`filter-pill ${statusFilter === s.val ? "active" : ""}`} onClick={() => setStatusFilter(s.val)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleExportCSV} disabled={filteredCustomers.length === 0}
            className="btn-secondary flex items-center gap-1.5 disabled:opacity-40" style={{ height: 38 }}>
            <Download size={15} /> Export CSV
          </button>
        </div>

        {/* Table View */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--text-secondary)]">Tidak ada pelanggan pada periode ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pelanggan</th>
                    <th className="text-center">Order Per. A</th>
                    <th className="text-center">Order Per. B</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(c => (
                    <tr key={c.id}>
                      <td>
                        <p className="text-sm font-medium text-white">{c.name}</p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">{maskPhone(c.whatsapp) || maskEmail(c.email)}</p>
                      </td>
                      <td className="text-center">
                        <span className="text-sm font-semibold">{c.periodATransactions}x</span>
                        <p className="text-[10px] text-[var(--text-muted)]">{formatRp(c.periodAAmount)}</p>
                      </td>
                      <td className="text-center">
                        {c.periodBTransactions > 0 ? (
                          <>
                            <span className="text-sm font-semibold text-emerald-400">{c.periodBTransactions}x</span>
                            <p className="text-[10px] text-emerald-400/70">{formatRp(c.periodBAmount)}</p>
                          </>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td>
                        {c.status === "retained" ? (
                          <span className="badge badge-success"><CheckCircle size={12} /> Repeat</span>
                        ) : (
                          <span className="badge badge-danger"><XCircle size={12} /> Belum</span>
                        )}
                      </td>
                      <td>
                        {c.status === "churned" && c.whatsapp && (
                          <button onClick={() => followUpWA(c)} className="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400">
                            <MessageCircle size={12} /> Chat WA
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-6 py-4 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                Menampilkan {filteredCustomers.length} dari {data?.customers.length || 0} pelanggan
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
