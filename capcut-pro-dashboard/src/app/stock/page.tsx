"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import {
  Plus,
  Search,
  Upload,
  X,
  Check,
  Copy,
  Loader2,
  Smartphone,
  Monitor,
  LayoutList,
  LayoutGrid,
  Users,
  User,
  ShoppingBag,
  CalendarDays,
  Shield,
  Trash2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

interface StockTransaction {
  user: { name: string; email: string; whatsapp: string | null } | null;
  amount: number | null;
  productName: string | null;
  purchaseDate: string | null;
  warrantyExpiredAt: string | null;
  status: string | null;
}

interface StockItem {
  id: string;
  accountEmail: string;
  accountPassword: string;
  status: string | null;
  durationDays: number | null;
  productType: string | null;
  maxSlots: number | null;
  usedSlots: number | null;
  notes: string | null;
  createdAt: string | null;
  transactions: StockTransaction[];
}

interface StockResponse {
  accounts: StockItem[];
  total: number;
  statusCounts: Record<string, number>;
  mobileStatusCounts: Record<string, number>;
  mobileTotal: number;
  desktopStatusCounts: Record<string, number>;
  desktopTotal: number;
  remainingSlotsMobile: number;
  remainingSlotsDesktop: number;
}

const statusFilters = ["Semua", "available", "in_use", "sold"];
const statusLabels: Record<string, string> = { Semua: "Semua", available: "Tersedia", in_use: "Digunakan", sold: "Sold" };

function getStockBadge(status: string | null) {
  switch (status) {
    case "available": return <span className="badge badge-success">Tersedia</span>;
    case "in_use": return <span className="badge badge-info">Digunakan</span>;
    case "sold": return <span className="badge badge-neutral">Sold</span>;
    case "full": return <span className="badge badge-neutral">Sold</span>;
    case "banned": return <span className="badge badge-danger">Banned</span>;
    case "expired": return <span className="badge badge-warning">Expired</span>;
    default: return <span className="badge badge-neutral">{status}</span>;
  }
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number | null) {
  if (!amount) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

// ─── Modal Cek Pengguna ───────────────────────────────────────────────────────
function UserCheckModal({ account, onClose }: { account: StockItem; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);

  // Filter transaksi yang punya user (slot terpakai)
  const usedTrx = account.transactions.filter(t => t.user !== null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 520 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#818cf8]" />
            <div>
              <h3 className="font-semibold text-white text-base">Cek Pengguna Akun</h3>
              <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{account.accountEmail}</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Slot summary bar */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-[rgba(255,255,255,0.05)] rounded-lg h-2 overflow-hidden">
              <div
                className="h-full rounded-lg transition-all"
                style={{
                  width: `${((account.usedSlots || 0) / (account.maxSlots || 3)) * 100}%`,
                  background: (account.usedSlots || 0) >= (account.maxSlots || 3) ? "#ef4444" : "#22c55e",
                }}
              />
            </div>
            <span className="text-xs font-semibold text-[var(--text-secondary)] flex-shrink-0">
              {account.usedSlots || 0}/{account.maxSlots || 3} slot terpakai
            </span>
          </div>

          {usedTrx.length === 0 ? (
            <div className="py-8 text-center">
              <Users size={32} className="mx-auto text-[var(--text-muted)] mb-2 opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">Belum ada pengguna di akun ini</p>
            </div>
          ) : (
            <>
              {/* Tabs: Pengguna 1, 2, 3... */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
                {usedTrx.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: activeTab === i ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${activeTab === i ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: activeTab === i ? "#818cf8" : "var(--text-muted)",
                    }}
                  >
                    <User size={11} />
                    Pengguna {i + 1}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {usedTrx[activeTab] && (() => {
                const trx = usedTrx[activeTab];
                const user = trx.user;
                const warrantyDate = trx.warrantyExpiredAt ? new Date(trx.warrantyExpiredAt) : null;
                const now = new Date();
                const isWarrantyActive = warrantyDate ? warrantyDate > now : false;
                const daysLeft = warrantyDate
                  ? Math.max(0, Math.ceil((warrantyDate.getTime() - now.getTime()) / 86400000))
                  : null;

                return (
                  <div className="space-y-3">
                    {/* User Info Card */}
                    <div className="rounded-xl p-4" style={{ background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.15)" }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-[rgba(129,140,248,0.2)] flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-[#818cf8]" />
                        </div>
                        <p className="text-xs font-semibold text-[#818cf8] uppercase tracking-wider">Info Pengguna</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">Nama</span>
                          <span className="text-sm font-semibold text-white">{user?.name || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">Email</span>
                          <span className="text-xs text-[var(--text-secondary)] font-mono">{user?.email || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">WhatsApp</span>
                          <span className="text-sm text-[var(--text-secondary)]">{user?.whatsapp || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Info Card */}
                    <div className="rounded-xl p-4" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-[rgba(34,197,94,0.15)] flex items-center justify-center flex-shrink-0">
                          <ShoppingBag size={14} className="text-emerald-400" />
                        </div>
                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Info Transaksi</p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">Produk</span>
                          <span className="text-sm text-[var(--text-secondary)]">{trx.productName || "CapCut Pro"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">Nominal</span>
                          <span className="text-sm font-semibold text-emerald-400">{formatCurrency(trx.amount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><CalendarDays size={10} /> Tanggal Beli</span>
                          <span className="text-sm text-[var(--text-secondary)]">{formatDate(trx.purchaseDate)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1"><Shield size={10} /> Garansi s/d</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--text-secondary)]">{formatDate(trx.warrantyExpiredAt)}</span>
                            {daysLeft !== null && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{
                                  background: isWarrantyActive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                  color: isWarrantyActive ? "#22c55e" : "#ef4444",
                                }}
                              >
                                {isWarrantyActive ? `${daysLeft}h lagi` : "Expired"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-muted)]">Status Trx</span>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                            style={{
                              background: trx.status === "success" ? "rgba(34,197,94,0.15)" : "rgba(251,191,36,0.15)",
                              color: trx.status === "success" ? "#22c55e" : "#fbbf24",
                            }}
                          >
                            {trx.status || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StockPage() {
  // State data
  const [accounts, setAccounts] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ available: 0, in_use: 0, sold: 0 });
  const [mobileStatusCounts, setMobileStatusCounts] = useState<Record<string, number>>({ available: 0, in_use: 0, sold: 0 });
  const [mobileTotal, setMobileTotal] = useState(0);
  const [desktopStatusCounts, setDesktopStatusCounts] = useState<Record<string, number>>({ available: 0, in_use: 0, sold: 0 });
  const [desktopTotal, setDesktopTotal] = useState(0);
  const [remainingSlotsMobile, setRemainingSlotsMobile] = useState(0);
  const [remainingSlotsDesktop, setRemainingSlotsDesktop] = useState(0);

  // Load More
  const [page, setPage] = useState(1);
  const limit = 50;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [singleForm, setSingleForm] = useState({ email: "", password: "", duration: 30, productType: "mobile", maxSlots: 3 });
  const [bulkText, setBulkText] = useState("");
  const [bulkDuration, setBulkDuration] = useState(30);
  const [bulkProductType, setBulkProductType] = useState("mobile");
  const [bulkMaxSlots, setBulkMaxSlots] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Cek Pengguna modal
  const [checkAccount, setCheckAccount] = useState<StockItem | null>(null);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<StockItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/stock/${deleteConfirm.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json.error || "Gagal menghapus akun");
        setDeleting(false);
        return;
      }
      setDeleteConfirm(null);
      fetchData(1, false);
    } catch {
      setDeleteError("Terjadi kesalahan jaringan");
    }
    setDeleting(false);
  }

  const fetchData = useCallback((pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "Semua") params.set("status", statusFilter);
    params.set("page", String(pageNum));
    params.set("limit", String(limit));

    fetch(`/api/stock?${params}`)
      .then((res) => res.json())
      .then((json) => {
        const newAccounts: StockItem[] = json.accounts || [];
        if (append) {
          setAccounts(prev => [...prev, ...newAccounts]);
        } else {
          setAccounts(newAccounts);
        }
        setTotal(json.total || 0);
        setHasMore(newAccounts.length >= limit);
        // Stats always use latest
        const sc: Record<string, number> = { available: 0, in_use: 0, sold: 0 };
        (json.statusCounts ? Object.entries(json.statusCounts) : []).forEach(([k, v]) => { sc[k] = v as number; });
        setStatusCounts(sc);

        const msc: Record<string, number> = { available: 0, in_use: 0, sold: 0 };
        (json.mobileStatusCounts ? Object.entries(json.mobileStatusCounts) : []).forEach(([k, v]) => { msc[k] = v as number; });
        setMobileStatusCounts(msc);
        setMobileTotal(json.mobileTotal ?? 0);

        const dsc: Record<string, number> = { available: 0, in_use: 0, sold: 0 };
        (json.desktopStatusCounts ? Object.entries(json.desktopStatusCounts) : []).forEach(([k, v]) => { dsc[k] = v as number; });
        setDesktopStatusCounts(dsc);
        setDesktopTotal(json.desktopTotal ?? 0);

        setRemainingSlotsMobile(json.remainingSlotsMobile ?? 0);
        setRemainingSlotsDesktop(json.remainingSlotsDesktop ?? 0);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (append) setLoadingMore(false);
        else setLoading(false);
      });
  }, [search, statusFilter]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchData(1, false);
  }, [fetchData]);

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    fetchData(next, true);
  }

  async function handleAddSingle() {
    if (!singleForm.email || !singleForm.password) return;
    setSubmitting(true);
    await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: singleForm.email,
        password: singleForm.password,
        durationDays: singleForm.duration,
        productType: singleForm.productType,
        maxSlots: singleForm.maxSlots,
      }),
    });
    setSubmitting(false);
    setShowSingleModal(false);
    setSingleForm({ email: "", password: "", duration: 30, productType: "mobile", maxSlots: 3 });
    fetchData(1, false);
  }

  async function handleBulkImport() {
    const lines = bulkText.split("\n").filter((l) => l.trim());
    const accounts = lines.map((line) => {
      const [email, password] = line.split(":").map((s) => s.trim());
      return { email, password };
    }).filter((a) => a.email && a.password);
    if (accounts.length === 0) return;
    setSubmitting(true);
    await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts, durationDays: bulkDuration, productType: bulkProductType, maxSlots: bulkMaxSlots }),
    });
    setSubmitting(false);
    setShowBulkModal(false);
    setBulkText("");
    fetchData(1, false);
  }

  function copyPassword(id: string, password: string) {
    navigator.clipboard.writeText(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleProductTypeChange(type: string) {
    setSingleForm({ ...singleForm, productType: type, maxSlots: type === "desktop" ? 2 : 3 });
  }
  function handleBulkProductTypeChange(type: string) {
    setBulkProductType(type);
    setBulkMaxSlots(type === "desktop" ? 2 : 3);
  }

  return (
    <>
      <Topbar title="Stok Akun" subtitle="Kelola stok akun CapCut Pro (Sharing Account)" />

      <div className="px-4 md:px-8 pb-8 space-y-5">
        {/* ── 3 Info Cards (Mobile, Desktop, Overall) ───────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Card 1 — Mobile */}
          <div
            className="glass-card p-4 flex flex-col gap-3"
            style={{ borderColor: "rgba(34,197,94,0.25)", background: "linear-gradient(135deg,rgba(34,197,94,0.05),rgba(16,185,129,0.03))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
                  <Smartphone size={16} className="text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-400 uppercase tracking-wider">Akun Mobile</p>
                  <p className="text-[10px] text-[var(--text-muted)]">HP / iPad / Tablet</p>
                </div>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
              >
                {mobileTotal} Akun
              </span>
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-green-500/10">
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-400">{mobileStatusCounts.available || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Tersedia</p>
              </div>
              <div className="text-center border-x border-green-500/10">
                <p className="text-xl font-bold text-cyan-400">{mobileStatusCounts.in_use || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Digunakan</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-400">{mobileStatusCounts.sold || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Sold</p>
              </div>
            </div>
            {/* Slot info */}
            <div className="flex items-center justify-between pt-1 border-t border-green-500/10">
              <span className="text-[10px] text-[var(--text-muted)]">Sisa Slot Tersedia</span>
              <span className="text-sm font-bold text-green-400">{remainingSlotsMobile} slot</span>
            </div>
          </div>

          {/* Card 2 — Desktop */}
          <div
            className="glass-card p-4 flex flex-col gap-3"
            style={{ borderColor: "rgba(59,130,246,0.25)", background: "linear-gradient(135deg,rgba(59,130,246,0.05),rgba(99,102,241,0.03))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <Monitor size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Akun Desktop</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Laptop / Mac / PC</p>
                </div>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa" }}
              >
                {desktopTotal} Akun
              </span>
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-blue-500/10">
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-400">{desktopStatusCounts.available || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Tersedia</p>
              </div>
              <div className="text-center border-x border-blue-500/10">
                <p className="text-xl font-bold text-cyan-400">{desktopStatusCounts.in_use || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Digunakan</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-400">{desktopStatusCounts.sold || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Sold</p>
              </div>
            </div>
            {/* Slot info */}
            <div className="flex items-center justify-between pt-1 border-t border-blue-500/10">
              <span className="text-[10px] text-[var(--text-muted)]">Sisa Slot Tersedia</span>
              <span className="text-sm font-bold text-blue-400">{remainingSlotsDesktop} slot</span>
            </div>
          </div>

          {/* Card 3 — Overall / Keseluruhan */}
          <div
            className="glass-card p-4 flex flex-col gap-3"
            style={{ borderColor: "rgba(129,140,248,0.25)", background: "linear-gradient(135deg,rgba(129,140,248,0.06),rgba(99,102,241,0.03))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                  <LayoutGrid size={16} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Keseluruhan</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Semua tipe akun</p>
                </div>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8" }}
              >
                {(statusCounts.available || 0) + (statusCounts.in_use || 0) + (statusCounts.sold || 0)} Akun
              </span>
            </div>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-indigo-500/10">
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-400">{statusCounts.available || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Tersedia</p>
              </div>
              <div className="text-center border-x border-indigo-500/10">
                <p className="text-xl font-bold text-cyan-400">{statusCounts.in_use || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Digunakan</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-400">{statusCounts.sold || 0}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Sold</p>
              </div>
            </div>
            {/* Slot total info */}
            <div className="flex items-center justify-between pt-1 border-t border-indigo-500/10">
              <span className="text-[10px] text-[var(--text-muted)]">Total Slot Kosong</span>
              <span className="text-sm font-bold text-indigo-400">{remainingSlotsMobile + remainingSlotsDesktop} slot</span>
            </div>
          </div>

        </div>

        {/* ── Actions toolbar ─────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Row 1: Search + Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="search-box flex-1 min-w-[160px] max-w-md">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Cari email akun..." className="form-input !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 ml-auto">
              <button className="btn-secondary" onClick={() => setShowBulkModal(true)}><Upload size={16} /> <span className="hidden sm:inline">Bulk Import</span></button>
              <button className="btn-primary" onClick={() => setShowSingleModal(true)}><Plus size={16} /> <span className="hidden sm:inline">Tambah Akun</span></button>
            </div>
          </div>
          {/* Row 2: Filter pills — always full width */}
          <div className="filter-pills-scroll">
            <div className="filter-pills flex-nowrap">
              {statusFilters.map((f) => (
                <button key={f} className={`filter-pill flex-shrink-0 ${statusFilter === f ? "active" : ""}`} onClick={() => setStatusFilter(f)}>
                  {statusLabels[f]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* View Toggle mobile */}
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-xs text-[var(--text-muted)]">Total {total} akun</p>
          <div className="flex gap-1">
            <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}><LayoutList size={13} /> Tabel</button>
            <button className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}><LayoutGrid size={13} /> Card</button>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[#818cf8]" />
              <span className="ml-2 text-[var(--text-secondary)]">Memuat...</span>
            </div>
          ) : (
            <>
              {viewMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tipe</th>
                        <th>Email Akun</th>
                        <th>Password</th>
                        <th>Slot</th>
                        <th>Durasi</th>
                        <th>Pengguna</th>
                        <th>Ditambahkan</th>
                        <th className="sticky-col-head">Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-8 text-[var(--text-muted)]">Belum ada stok akun</td></tr>
                      ) : accounts.map((item) => {
                        const usedTrx = item.transactions.filter(t => t.user !== null);
                        return (
                          <tr key={item.id}>
                            <td><span className="flex items-center gap-1.5 text-xs font-medium">{item.productType === "desktop" ? <><Monitor size={14} className="text-blue-400" />Desktop</> : <><Smartphone size={14} className="text-green-400" />Mobile</>}</span></td>
                            <td className="font-mono text-sm">{item.accountEmail}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-[var(--text-secondary)]">••••••••</span>
                                <button className="btn-icon" style={{ width: 28, height: 28 }} title="Copy Password" onClick={() => copyPassword(item.id, item.accountPassword)}>
                                  {copiedId === item.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                </button>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${(item.usedSlots || 0) / (item.maxSlots || 3) * 100}%`, background: (item.usedSlots || 0) >= (item.maxSlots || 3) ? "#ef4444" : "#22c55e" }} />
                                </div>
                                <span className="text-xs font-medium text-[var(--text-secondary)]">{item.usedSlots || 0}/{item.maxSlots || 3}</span>
                              </div>
                            </td>
                            <td className="text-sm">{item.durationDays || 30} Hari</td>
                            <td>
                              {usedTrx.length > 0 ? (
                                <button
                                  onClick={() => setCheckAccount(item)}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                  style={{
                                    background: "rgba(129,140,248,0.1)",
                                    border: "1px solid rgba(129,140,248,0.25)",
                                    color: "#818cf8",
                                  }}
                                >
                                  <Users size={12} />
                                  {usedTrx.length} Pengguna
                                </button>
                              ) : (
                                <span className="text-sm text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="text-[var(--text-secondary)] text-sm">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "—"}</td>
                            <td className="sticky-col-body">{getStockBadge(item.status)}</td>
                            <td>
                              <button
                                onClick={() => { setDeleteConfirm(item); setDeleteError(null); }}
                                className="btn-icon hover:text-rose-400 hover:bg-rose-500/10"
                                style={{ width: 30, height: 30 }}
                                title="Hapus akun"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {viewMode === 'card' && (
                <div className="data-card-grid">
                  {accounts.length === 0 ? <p className="text-center py-8 text-[var(--text-muted)]">Belum ada stok akun</p> : accounts.map((item) => {
                    const usedTrx = item.transactions.filter(t => t.user !== null);
                    return (
                      <div key={item.id} className="data-card">
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 flex-1 mr-2">
                            <p className="font-mono text-sm text-white truncate">{item.accountEmail}</p>
                            <span className="flex items-center gap-1 text-xs font-medium mt-1 text-[var(--text-muted)]">
                              {item.productType === "desktop" ? <><Monitor size={12} className="text-blue-400" />Desktop</> : <><Smartphone size={12} className="text-green-400" />Mobile</>}
                            </span>
                          </div>
                          {getStockBadge(item.status)}
                        </div>
                        <div className="space-y-1.5 pt-2.5 border-t border-[rgba(99,102,241,0.08)]">
                          <div className="data-card-row">
                            <span className="data-card-label">Slot</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${(item.usedSlots || 0) / (item.maxSlots || 3) * 100}%`, background: (item.usedSlots || 0) >= (item.maxSlots || 3) ? "#ef4444" : "#22c55e" }} />
                              </div>
                              <span className="text-xs text-[var(--text-secondary)]">{item.usedSlots || 0}/{item.maxSlots || 3}</span>
                            </div>
                          </div>
                          <div className="data-card-row"><span className="data-card-label">Durasi</span><span className="data-card-value">{item.durationDays || 30} Hari</span></div>
                          <div className="data-card-row">
                            <span className="data-card-label">Password</span>
                            <span className="data-card-value flex items-center gap-1.5">••••••••
                              <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => copyPassword(item.id, item.accountPassword)}>
                                {copiedId === item.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                              </button>
                            </span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">Pengguna</span>
                            {usedTrx.length > 0 ? (
                              <button
                                onClick={() => setCheckAccount(item)}
                                className="flex items-center gap-1 text-xs font-semibold"
                                style={{ color: "#818cf8" }}
                              >
                                <Users size={11} /> {usedTrx.length} Orang
                              </button>
                            ) : <span className="data-card-value">—</span>}
                          </div>
                          <div className="data-card-row"><span className="data-card-label">Ditambahkan</span><span className="data-card-value">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "—"}</span></div>
                          <div className="pt-2 border-t border-[rgba(99,102,241,0.08)] mt-1">
                            <button
                              onClick={() => { setDeleteConfirm(item); setDeleteError(null); }}
                              className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              <Trash2 size={13} /> Hapus Akun
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* ── Load More Footer ── */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(99,102,241,0.08)] gap-3">
                <p className="text-sm text-[var(--text-muted)]">Menampilkan <span className="font-semibold text-white">{accounts.length}</span> dari <span className="font-semibold text-white">{total}</span> akun</p>
                {hasMore && !loading ? (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.25)",
                      color: "#818cf8",
                      cursor: loadingMore ? "wait" : "pointer",
                    }}
                  >
                    {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                    {loadingMore ? "Memuat..." : `Tampilkan ${Math.min(limit, total - accounts.length)} akun berikutnya`}
                  </button>
                ) : !loading && accounts.length > 0 ? (
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                    <Check size={12} className="text-emerald-400" /> Semua data sudah ditampilkan
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Cek Pengguna */}
      {checkAccount && (
        <UserCheckModal account={checkAccount} onClose={() => setCheckAccount(null)} />
      )}

      {/* Modal Tambah Single */}
      {showSingleModal && (
        <div className="modal-overlay" onClick={() => setShowSingleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg">Tambah Stok Akun</h3>
              <button className="btn-icon" onClick={() => setShowSingleModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="form-label">Email Akun</label><input type="email" className="form-input" placeholder="email@capcut.com" value={singleForm.email} onChange={(e) => setSingleForm({ ...singleForm, email: e.target.value })} /></div>
              <div><label className="form-label">Password Akun</label><input type="text" className="form-input" placeholder="Masukkan password" value={singleForm.password} onChange={(e) => setSingleForm({ ...singleForm, password: e.target.value })} /></div>
              <div>
                <label className="form-label">Tipe Produk</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleProductTypeChange("mobile")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${singleForm.productType === "mobile" ? "border-green-500 bg-green-500/15 text-green-400" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)] hover:border-[rgba(255,255,255,0.2)]"}`}>
                    <Smartphone size={16} /> HP/iPad/Tablet
                  </button>
                  <button type="button" onClick={() => handleProductTypeChange("desktop")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${singleForm.productType === "desktop" ? "border-blue-500 bg-blue-500/15 text-blue-400" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)] hover:border-[rgba(255,255,255,0.2)]"}`}>
                    <Monitor size={16} /> Laptop/Mac/Desktop
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Slot Pengguna</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setSingleForm({ ...singleForm, maxSlots: n })}
                      className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${singleForm.maxSlots === n ? "border-[var(--accent)] bg-[rgba(99,102,241,0.15)] text-[var(--accent)]" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)] hover:border-[rgba(255,255,255,0.2)]"}`}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {singleForm.productType === "mobile" ? "Rekomendasi: 3 slot untuk HP/iPad/Tablet" : "Rekomendasi: 2 slot untuk Laptop/Mac/Desktop"}
                </p>
              </div>
              <div><label className="form-label">Durasi Langganan</label><select className="form-input" value={singleForm.duration} onChange={(e) => setSingleForm({ ...singleForm, duration: parseInt(e.target.value) })}><option value="30">30 Hari</option><option value="60">60 Hari</option><option value="90">90 Hari</option></select></div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSingleModal(false)}>Batal</button>
              <button className="btn-primary" onClick={handleAddSingle} disabled={submitting}>{submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bulk Import */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg">Bulk Import Stok Akun</h3>
              <button className="btn-icon" onClick={() => setShowBulkModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">Paste daftar akun dengan format: <code className="text-[#818cf8]">email:password</code> (satu per baris)</p>
              <div><label className="form-label">Daftar Akun</label><textarea className="form-input" rows={8} placeholder={"akun1@mail.com:password1\nakun2@mail.com:password2"} value={bulkText} onChange={(e) => setBulkText(e.target.value)} /></div>
              <div>
                <label className="form-label">Tipe Produk</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleBulkProductTypeChange("mobile")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${bulkProductType === "mobile" ? "border-green-500 bg-green-500/15 text-green-400" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)]"}`}>
                    <Smartphone size={16} /> HP/iPad/Tablet
                  </button>
                  <button type="button" onClick={() => handleBulkProductTypeChange("desktop")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-all ${bulkProductType === "desktop" ? "border-blue-500 bg-blue-500/15 text-blue-400" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)]"}`}>
                    <Monitor size={16} /> Laptop/Mac/Desktop
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Slot Pengguna</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setBulkMaxSlots(n)}
                      className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${bulkMaxSlots === n ? "border-[var(--accent)] bg-[rgba(99,102,241,0.15)] text-[var(--accent)]" : "border-[rgba(255,255,255,0.1)] text-[var(--text-muted)]"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="form-label">Durasi Langganan</label><select className="form-input" value={bulkDuration} onChange={(e) => setBulkDuration(parseInt(e.target.value))}><option value="30">30 Hari</option><option value="60">60 Hari</option><option value="90">90 Hari</option></select></div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBulkModal(false)}>Batal</button>
              <button className="btn-primary" onClick={handleBulkImport} disabled={submitting}>{submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Import Semua</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Konfirmasi Hapus */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => { if (!deleting) { setDeleteConfirm(null); setDeleteError(null); } }}>
          <div
            className="modal-content"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Hapus Stok Akun?</h3>
                  <p className="text-xs text-[var(--text-muted)]">Tindakan ini tidak bisa dibatalkan</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => { setDeleteConfirm(null); setDeleteError(null); }} disabled={deleting}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body space-y-4">
              {/* Akun info */}
              <div
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p className="text-xs text-[var(--text-muted)] mb-1">Akun yang akan dihapus:</p>
                <p className="font-mono text-sm text-white">{deleteConfirm.accountEmail}</p>
                <div className="flex items-center gap-3 mt-2">
                  {getStockBadge(deleteConfirm.status)}
                  <span className="text-xs text-[var(--text-muted)]">
                    {deleteConfirm.usedSlots || 0}/{deleteConfirm.maxSlots || 3} slot terpakai
                  </span>
                </div>
              </div>

              {/* Warning jika ada slot terpakai */}
              {(deleteConfirm.usedSlots ?? 0) > 0 && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl"
                  style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
                >
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    Akun ini masih dipakai <strong>{deleteConfirm.usedSlots} pelanggan</strong>.
                    Pastikan slot sudah tidak aktif sebelum menghapus, atau akun
                    {" "}
                    <span className="text-rose-400 font-semibold">in_use</span> tidak dapat dihapus.
                  </p>
                </div>
              )}

              {/* Error message */}
              {deleteError && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <AlertTriangle size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-300">{deleteError}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  boxShadow: "0 4px 15px rgba(239,68,68,0.25)",
                  cursor: deleting ? "wait" : "pointer",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? "Menghapus..." : "Ya, Hapus Akun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
