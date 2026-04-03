"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Plus,
  Search,
  X,
  Check,
  Loader2,
  Send,
  CalendarDays,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Copy,
  LayoutList,
  LayoutGrid,
} from "lucide-react";

interface Transaction {
  id: string;
  lynkIdRef: string | null;
  amount: number;
  productName: string | null;
  status: string | null;
  isManual: boolean | null;
  purchaseDate: string | null;
  warrantyExpiredAt: string | null;
  createdAt: string | null;
  user: { id: string; name: string; email: string; whatsapp: string | null } | null;
  stockAccount: { id: string; accountEmail: string; status: string | null } | null;
}

const statusFilters = ["Semua", "success", "pending", "failed"];
const statusLabels: Record<string, string> = { Semua: "Semua", success: "Sukses", pending: "Pending", failed: "Gagal" };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("id-ID", { 
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
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

const sourceFilters = ["Semua", "lynkid", "manual"];
const sourceLabels: Record<string, string> = { Semua: "Semua Sumber", lynkid: "Lynk.id", manual: "Manual" };

export default function TransactionsPage() {
  const { maskEmail, maskPhone } = usePrivacy();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [sourceFilter, setSourceFilter] = useState("Semua");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ account?: { email: string; password: string }; message?: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", amount: "", productName: "" });

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  function copyUUID(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; summary: { total: number; created: number; skipped: number; usersCreated: number; usersUpdated: number; errors: string[] } } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; batches: number; currentBatch: number } | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "Semua") params.set("status", statusFilter);
    if (sourceFilter !== "Semua") params.set("source", sourceFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/transactions?${params}`)
      .then((res) => res.json())
      .then((json) => { setTransactions(json.transactions || []); setTotal(json.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter, sourceFilter, startDate, endDate, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page to 1 when filters/search change
  useEffect(() => { setPage(1); }, [search, statusFilter, sourceFilter, startDate, endDate]);

  const totalPages = Math.ceil(total / limit);


  async function handleAddManual() {
    if (!form.name || !form.email || !form.whatsapp) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, whatsapp: form.whatsapp, amount: parseFloat(form.amount) || 0, productName: form.productName || "CapCut Pro" }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ account: json.account, message: json.message });
        fetchData();
      } else {
        setResult({ message: json.error || "Gagal membuat transaksi" });
      }
    } catch { setResult({ message: "Koneksi error" }); }
    setSubmitting(false);
  }

  function closeModal() {
    setShowModal(false);
    setForm({ name: "", email: "", whatsapp: "", amount: "", productName: "" });
    setResult(null);
  }

  function closeImportModal() {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
    setImportProgress(null);
  }

  /** RFC-4180 CSV parser — handles quoted fields with commas/newlines */
  function parseCSV(text: string): Record<string, string>[] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    // Normalize line endings
    const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    while (i < s.length) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ""; i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += ch; i++;
    }
    // Last field & row
    row.push(field);
    if (row.some(f => f !== "")) rows.push(row);

    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(vals => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (vals[idx] ?? "").trim(); });
      return obj;
    });
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      let transactions: Record<string, unknown>[] = [];
      const fileName = importFile.name.toLowerCase();

      if (fileName.endsWith(".json")) {
        const text = await importFile.text();
        const parsed = JSON.parse(text);
        transactions = Array.isArray(parsed) ? parsed : (parsed.transactions || parsed.data || []);
      } else if (fileName.endsWith(".csv")) {
        const text = await importFile.text();
        transactions = parseCSV(text);
        if (transactions.length === 0) throw new Error("File CSV kosong atau hanya header.");
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        // Parse Excel (XLSX/XLS)
        const arrayBuffer = await importFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("File Excel kosong, tidak ada sheet.");
        const worksheet = workbook.Sheets[firstSheetName];
        transactions = XLSX.utils.sheet_to_json(worksheet);
        if (transactions.length === 0) throw new Error("Sheet pertama kosong atau hanya header.");
      } else {
        throw new Error("Format file tidak didukung. Gunakan .json, .csv, atau .xlsx");
      }

      // ===== Kirim ke API dalam batch 50 baris agar tidak timeout =====
      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(transactions.length / BATCH_SIZE);

      // Akumulator hasil dari semua batch
      let totalCreated = 0;
      let totalSkipped = 0;
      let totalUsersCreated = 0;
      let totalUsersUpdated = 0;
      const allErrors: string[] = [];

      setImportProgress({ current: 0, total: transactions.length, batches: totalBatches, currentBatch: 0 });

      for (let b = 0; b < totalBatches; b++) {
        const batch = transactions.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        setImportProgress({ current: b * BATCH_SIZE, total: transactions.length, batches: totalBatches, currentBatch: b + 1 });

        const res = await fetch("/api/transactions/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: batch }),
        });

        // Safe JSON parse
        const rawText = await res.text();
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(rawText);
        } catch {
          allErrors.push(`Batch ${b + 1}: Server error (timeout?) — ${rawText.substring(0, 150)}`);
          continue; // lanjut ke batch berikutnya
        }

        if (res.ok && json.summary) {
          const s = json.summary as { created: number; skipped: number; usersCreated: number; usersUpdated: number; errors: string[] };
          totalCreated += s.created || 0;
          totalSkipped += s.skipped || 0;
          totalUsersCreated += s.usersCreated || 0;
          totalUsersUpdated += s.usersUpdated || 0;
          if (s.errors?.length) allErrors.push(...s.errors);
        } else {
          allErrors.push(`Batch ${b + 1}: ${ (json.error as string) || "Server error" }`);
        }
      }

      setImportProgress({ current: transactions.length, total: transactions.length, batches: totalBatches, currentBatch: totalBatches });

      setImportResult({
        success: true,
        summary: {
          total: transactions.length,
          created: totalCreated,
          skipped: totalSkipped,
          usersCreated: totalUsersCreated,
          usersUpdated: totalUsersUpdated,
          errors: allErrors.slice(0, 20),
        },
      });
      fetchData();
    } catch (err) {
      setImportResult({ success: false, summary: { total: 0, created: 0, skipped: 0, usersCreated: 0, usersUpdated: 0, errors: [err instanceof Error ? err.message : String(err)] } });
    }
    setImporting(false);
  }

  return (
    <>
      <Topbar title="Transaksi" subtitle="Kelola transaksi penjualan CapCut Pro" />

      <div className="px-4 md:px-8 pb-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="search-box flex-1 min-w-[160px] max-w-xs">
                <Search size={16} className="search-icon" />
                <input type="text" placeholder="Cari nama, email, ID..." className="form-input !pl-10 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 h-[38px] flex-shrink-0">
                <CalendarDays size={14} className="text-[var(--text-muted)]" />
                <input type="date" className="bg-transparent text-sm text-[var(--text-secondary)] outline-none w-[110px]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span className="text-[var(--text-muted)] text-sm">-</span>
                <input type="date" className="bg-transparent text-sm text-[var(--text-secondary)] outline-none w-[110px]" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="filter-pills-scroll">
                <div className="filter-pills flex-nowrap">
                  {sourceFilters.map((f) => (
                    <button key={f} className={`filter-pill flex-shrink-0 ${sourceFilter === f ? "active" : ""}`} onClick={() => setSourceFilter(f)}>{sourceLabels[f]}</button>
                  ))}
                </div>
              </div>
              <div className="filter-pills-scroll">
                <div className="filter-pills flex-nowrap">
                  {statusFilters.map((f) => (
                    <button key={f} className={`filter-pill flex-shrink-0 ${statusFilter === f ? "active" : ""}`} onClick={() => setStatusFilter(f)}>{statusLabels[f]}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => setShowImportModal(true)}><Upload size={16} /> Import Lynk.id</button>
            <button className="btn-primary flex-shrink-0" onClick={() => setShowModal(true)}><Plus size={16} /> Tambah Manual</button>
          </div>
        </div>

        {/* ── View Toggle (mobile only) ── */}
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-xs text-[var(--text-muted)]">Total {total} transaksi</p>
          <div className="flex gap-1">
            <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
              <LayoutList size={13} /> Tabel
            </button>
            <button className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}>
              <LayoutGrid size={13} /> Card
            </button>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#818cf8]" /><span className="ml-2 text-[var(--text-secondary)]">Memuat...</span></div>
          ) : (
            <>
              {/* ── Table View ── */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>UUID (Transaksi)</th>
                        <th>Lynk.id Ref</th>
                        <th>Pelanggan</th>
                        <th>WhatsApp</th>
                        <th>Akun CapCut</th>
                        <th>Produk</th>
                        <th>Nominal</th>
                        <th>Tanggal Beli</th>
                        <th>Garansi s/d</th>
                        <th>Dibuat</th>
                        <th>Sumber</th>
                        <th className="sticky-col-head">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan={12} className="text-center py-8 text-[var(--text-muted)]">Belum ada transaksi</td></tr>
                      ) : (
                        transactions.map((trx) => (
                          <tr key={trx.id}>
                            <td className="font-mono text-xs text-[#818cf8]">
                              <div className="flex items-center gap-1.5">
                                <span title={trx.id}>{trx.id.substring(0, 8)}...</span>
                                <button onClick={() => copyUUID(trx.id)} title="Copy UUID" className="text-[var(--text-muted)] hover:text-white transition-colors">
                                  {copiedId === trx.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                            </td>
                            <td className="font-mono text-xs text-[var(--text-muted)]">{trx.lynkIdRef || <span className="opacity-40">-</span>}</td>
                            <td>
                              <p className="font-medium">{trx.user?.name || "-"}</p>
                              <p className="text-xs text-[var(--text-muted)]">{maskEmail(trx.user?.email)}</p>
                            </td>
                            <td className="text-sm text-[var(--text-secondary)]">{maskPhone(trx.user?.whatsapp)}</td>
                            <td className="font-mono text-xs">{trx.stockAccount?.accountEmail || "-"}</td>
                            <td className="text-sm font-medium text-[#c7d2fe]">{trx.productName || <span className="text-[var(--text-muted)] italic text-xs">CapCut Pro (Default)</span>}</td>
                            <td className="font-semibold">{formatCurrency(Number(trx.amount))}</td>
                            <td className="text-[var(--text-secondary)] text-sm">{formatDateTime(trx.purchaseDate)}</td>
                            <td className="text-sm">{formatDate(trx.warrantyExpiredAt)}</td>
                            <td className="text-xs text-[var(--text-muted)]">{formatDateTime(trx.createdAt ?? null)}</td>
                            <td>{trx.isManual ? <span className="badge badge-purple">Manual</span> : <span className="badge badge-info">Lynk.id</span>}</td>
                            <td className="sticky-col-body">{getStatusBadge(trx.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Card View (mobile) ── */}
              {viewMode === 'card' && (
                <div className="data-card-grid">
                  {transactions.length === 0 ? (
                    <p className="text-center py-8 text-[var(--text-muted)]">Belum ada transaksi</p>
                  ) : (
                    transactions.map((trx) => (
                      <div key={trx.id} className="data-card">
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 flex-1 mr-2">
                            <p className="font-semibold text-white text-sm truncate">{trx.user?.name || "-"}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate">{maskEmail(trx.user?.email)}</p>
                          </div>
                          {getStatusBadge(trx.status)}
                        </div>
                        <div className="space-y-1.5 pt-2.5 border-t border-[rgba(99,102,241,0.08)]">
                          <div className="data-card-row">
                            <span className="data-card-label">Nominal</span>
                            <span className="data-card-value font-semibold text-white">{formatCurrency(Number(trx.amount))}</span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">Produk</span>
                            <span className="data-card-value text-[#c7d2fe]">{trx.productName || "CapCut Pro"}</span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">Akun</span>
                            <span className="data-card-value font-mono text-xs">{trx.stockAccount?.accountEmail || "-"}</span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">Tanggal Beli</span>
                            <span className="data-card-value">{formatDate(trx.purchaseDate)}</span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">Garansi s/d</span>
                            <span className="data-card-value">{formatDate(trx.warrantyExpiredAt)}</span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">Sumber</span>
                            <span className="data-card-value">{trx.isManual ? <span className="badge badge-purple">Manual</span> : <span className="badge badge-info">Lynk.id</span>}</span>
                          </div>
                          <div className="data-card-row">
                            <span className="data-card-label">WA</span>
                            <span className="data-card-value">{maskPhone(trx.user?.whatsapp)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Pagination ── */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(99,102,241,0.08)] gap-3">
                <p className="text-sm text-[var(--text-muted)]">Total {total} transaksi &bull; Hal. {page}/{totalPages}</p>
                <div className="flex items-center gap-2">
                  <button className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}>← Prev</button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (page <= 3) pageNum = i + 1;
                      else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = page - 2 + i;
                      return (
                        <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-7 h-7 rounded-lg text-xs font-medium ${pageNum === page ? 'bg-[rgba(99,102,241,0.3)] text-white border border-[rgba(99,102,241,0.5)]' : 'text-[var(--text-muted)] hover:bg-[rgba(99,102,241,0.1)] hover:text-white'}`}>{pageNum}</button>
                      );
                    })}
                  </div>
                  <button className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Next →</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Tambah Manual */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2"><Send size={18} className="text-[#818cf8]" /> Transaksi Manual</h3>
              <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
            </div>
            <div className="modal-body space-y-4">
              {result?.account ? (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                  <p className="font-semibold text-emerald-300">✅ {result.message}</p>
                  <div className="bg-[var(--bg-primary)] rounded-lg p-3 font-mono text-sm space-y-1">
                    <p><span className="text-[var(--text-muted)]">Email:</span> <span className="text-white">{result.account.email}</span></p>
                    <p><span className="text-[var(--text-muted)]">Password:</span> <span className="text-white">{result.account.password}</span></p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Salin dan kirim data ini ke pelanggan via WhatsApp.</p>
                </div>
              ) : (
                <>
                  <div><label className="form-label">Nama Pelanggan</label><input type="text" className="form-input" placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><label className="form-label">Email Pelanggan</label><input type="email" className="form-input" placeholder="email@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><label className="form-label">Nomor WhatsApp</label><input type="text" className="form-input" placeholder="08xxxxxxxxxx" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
                  <div><label className="form-label">Nama Produk (Opsional)</label><input type="text" className="form-input" placeholder="CapCut Pro PC 1 Bulan" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></div>
                  <div><label className="form-label">Nominal (Rp)</label><input type="number" className="form-input" placeholder="35000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                  {result?.message && <p className="text-sm text-rose-400">{result.message}</p>}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Tutup</button>
              {!result?.account && (
                <button className="btn-success" onClick={handleAddManual} disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Simpan & Kirim Akun
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Lynk.id */}
      {showImportModal && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#818cf8]" /> Import Data Lynk.id</h3>
              <button className="btn-icon" onClick={closeImportModal}><X size={18} /></button>
            </div>
            <div className="modal-body space-y-4">
              {importResult ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${importResult.success ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}`}>
                    <p className={`font-semibold ${importResult.success ? "text-emerald-300" : "text-rose-300"} flex items-center gap-2`}>
                      {importResult.success ? <><CheckCircle size={16} /> Import Berhasil!</> : <><AlertTriangle size={16} /> Import Gagal</>}
                    </p>
                  </div>

                  {importResult.success && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <p className="text-lg font-bold text-emerald-400">{importResult.summary.created}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">Transaksi Dibuat</p>
                      </div>
                      <div className="p-3 rounded-xl text-center" style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)" }}>
                        <p className="text-lg font-bold text-yellow-400">{importResult.summary.skipped}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">Dilewati (Duplikat)</p>
                      </div>
                      <div className="p-3 rounded-xl text-center" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                        <p className="text-lg font-bold text-[#818cf8]">{importResult.summary.usersCreated}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">User Baru Dibuat</p>
                      </div>
                      <div className="p-3 rounded-xl text-center" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
                        <p className="text-lg font-bold text-cyan-400">{importResult.summary.usersUpdated}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">User Diperbarui</p>
                      </div>
                    </div>
                  )}

                  {importResult.summary.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-rose-400 mb-1">Errors:</p>
                      {importResult.summary.errors.map((e, i) => (
                        <p key={i} className="text-xs text-rose-300/80">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px dashed var(--border-color)" }}>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">Upload file transaksi dari Lynk.id dalam format <span className="text-white font-medium">.json</span>, <span className="text-white font-medium">.csv</span>, atau <span className="text-white font-medium">.xlsx</span></p>
                    <input
                      type="file"
                      accept=".json,.csv,.xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[rgba(99,102,241,0.15)] file:text-[#818cf8] hover:file:bg-[rgba(99,102,241,0.25)] file:cursor-pointer file:transition-colors"
                    />
                    {importFile && (
                      <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                        <CheckCircle size={12} /> {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      <span className="text-[#818cf8] font-semibold">ℹ️ Info:</span> Data user (nama, email, whatsapp) otomatis dibuat/diperbarui. Transaksi duplikat (ID Lynk.id sama) akan otomatis dilewati.
                    </p>
                  </div>
                  {importing && importProgress && (
                    <div className="space-y-2 p-3 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#818cf8] font-semibold flex items-center gap-1.5">
                          <Loader2 size={13} className="animate-spin" />
                          Mengimpor batch {importProgress.currentBatch} dari {importProgress.batches}...
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {importProgress.current}/{importProgress.total} baris
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(99,102,241,0.15)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%`,
                            background: "linear-gradient(90deg, #6366f1, #818cf8)"
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">Jangan tutup halaman ini sampai selesai.</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeImportModal} disabled={importing}>{importResult ? "Tutup" : "Batal"}</button>
              {!importResult && (
                <button className="btn-primary gap-2 disabled:opacity-50" onClick={handleImport} disabled={importing || !importFile}>
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {importing ? "Mengimpor..." : "Mulai Import"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
