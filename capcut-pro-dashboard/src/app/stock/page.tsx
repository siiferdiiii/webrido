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
} from "lucide-react";

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
  transactions: Array<{ user: { name: string; email: string } | null }>;
}

interface StockResponse {
  accounts: StockItem[];
  total: number;
  statusCounts: Record<string, number>;
}

const statusFilters = ["Semua", "available", "full", "banned", "expired"];
const statusLabels: Record<string, string> = { Semua: "Semua", available: "Tersedia", full: "Penuh", banned: "Banned", expired: "Expired" };

function getStockBadge(status: string | null) {
  switch (status) {
    case "available": return <span className="badge badge-success">Tersedia</span>;
    case "full": return <span className="badge badge-info">Penuh</span>;
    case "banned": return <span className="badge badge-danger">Banned</span>;
    case "expired": return <span className="badge badge-warning">Expired</span>;
    default: return <span className="badge badge-neutral">{status}</span>;
  }
}

export default function StockPage() {
  const [data, setData] = useState<StockResponse | null>(null);
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

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "Semua") params.set("status", statusFilter);
    fetch(`/api/stock?${params}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    fetchData();
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
    fetchData();
  }

  function copyPassword(id: string, password: string) {
    navigator.clipboard.writeText(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Auto-update maxSlots saat productType berubah (single form)
  function handleProductTypeChange(type: string) {
    setSingleForm({ ...singleForm, productType: type, maxSlots: type === "desktop" ? 2 : 3 });
  }
  function handleBulkProductTypeChange(type: string) {
    setBulkProductType(type);
    setBulkMaxSlots(type === "desktop" ? 2 : 3);
  }

  const accounts = data?.accounts || [];
  const sc = data?.statusCounts || { available: 0, full: 0, banned: 0, expired: 0 };

  return (
    <>
      <Topbar title="Stok Akun" subtitle="Kelola stok akun CapCut Pro (Sharing Account)" />

      <div className="px-4 md:px-8 pb-8 space-y-5">
        {/* Mini Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{sc.available || 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Tersedia</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{sc.full || 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Penuh</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-rose-400">{sc.banned || 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Banned</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{sc.expired || 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Expired</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="search-box flex-1 max-w-md">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Cari email akun..." className="form-input !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-pills">
              {statusFilters.map((f) => (
                <button key={f} className={`filter-pill ${statusFilter === f ? "active" : ""}`} onClick={() => setStatusFilter(f)}>
                  {statusLabels[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowBulkModal(true)}><Upload size={16} /> Bulk Import</button>
            <button className="btn-primary" onClick={() => setShowSingleModal(true)}><Plus size={16} /> Tambah Akun</button>
          </div>
        </div>

        {/* View Toggle mobile */}
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-xs text-[var(--text-muted)]">Total {data?.total||0} akun</p>
          <div className="flex gap-1">
            <button className={`view-toggle-btn ${viewMode==='table'?'active':''}`} onClick={()=>setViewMode('table')}><LayoutList size={13}/> Tabel</button>
            <button className={`view-toggle-btn ${viewMode==='card'?'active':''}`} onClick={()=>setViewMode('card')}><LayoutGrid size={13}/> Card</button>
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
              {viewMode==='table' && (
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
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.length===0 ? (
                        <tr><td colSpan={8} className="text-center py-8 text-[var(--text-muted)]">Belum ada stok akun</td></tr>
                      ) : accounts.map((item)=>(
                        <tr key={item.id}>
                          <td><span className="flex items-center gap-1.5 text-xs font-medium">{item.productType==="desktop"?(<><Monitor size={14} className="text-blue-400"/>Desktop</>):(<><Smartphone size={14} className="text-green-400"/>Mobile</>)}</span></td>
                          <td className="font-mono text-sm">{item.accountEmail}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-[var(--text-secondary)]">••••••••</span>
                              <button className="btn-icon" style={{width:28,height:28}} title="Copy Password" onClick={()=>copyPassword(item.id,item.accountPassword)}>
                                {copiedId===item.id?<Check size={13} className="text-emerald-400"/>:<Copy size={13}/>}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{width:`${(item.usedSlots||0)/(item.maxSlots||3)*100}%`,background:(item.usedSlots||0)>=(item.maxSlots||3)?"#ef4444":"#22c55e"}}/>
                              </div>
                              <span className="text-xs font-medium text-[var(--text-secondary)]">{item.usedSlots||0}/{item.maxSlots||3}</span>
                            </div>
                          </td>
                          <td className="text-sm">{item.durationDays||30} Hari</td>
                          <td>{item.transactions?.length>0?(<div className="space-y-0.5">{item.transactions.slice(0,3).map((t,i)=>t.user?.name?<p key={i} className="text-xs font-medium text-[#818cf8]">{t.user.name}</p>:null)}</div>):(<span className="text-sm text-[var(--text-muted)]">—</span>)}</td>
                          <td className="text-[var(--text-secondary)] text-sm">{item.createdAt?new Date(item.createdAt).toLocaleDateString("id-ID"):"-"}</td>
                          <td className="sticky-col-body">{getStockBadge(item.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewMode==='card' && (
                <div className="data-card-grid">
                  {accounts.length===0?<p className="text-center py-8 text-[var(--text-muted)]">Belum ada stok akun</p>:accounts.map((item)=>(
                    <div key={item.id} className="data-card">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-mono text-sm text-white truncate">{item.accountEmail}</p>
                          <span className="flex items-center gap-1 text-xs font-medium mt-1 text-[var(--text-muted)]">
                            {item.productType==="desktop"?<><Monitor size={12} className="text-blue-400"/>Desktop</>:<><Smartphone size={12} className="text-green-400"/>Mobile</>}
                          </span>
                        </div>
                        {getStockBadge(item.status)}
                      </div>
                      <div className="space-y-1.5 pt-2.5 border-t border-[rgba(99,102,241,0.08)]">
                        <div className="data-card-row">
                          <span className="data-card-label">Slot</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{width:`${(item.usedSlots||0)/(item.maxSlots||3)*100}%`,background:(item.usedSlots||0)>=(item.maxSlots||3)?"#ef4444":"#22c55e"}}/>
                            </div>
                            <span className="text-xs text-[var(--text-secondary)]">{item.usedSlots||0}/{item.maxSlots||3}</span>
                          </div>
                        </div>
                        <div className="data-card-row"><span className="data-card-label">Durasi</span><span className="data-card-value">{item.durationDays||30} Hari</span></div>
                        <div className="data-card-row">
                          <span className="data-card-label">Password</span>
                          <span className="data-card-value flex items-center gap-1.5">••••••••
                            <button className="btn-icon" style={{width:22,height:22}} onClick={()=>copyPassword(item.id,item.accountPassword)}>
                              {copiedId===item.id?<Check size={10} className="text-emerald-400"/>:<Copy size={10}/>}
                            </button>
                          </span>
                        </div>
                        {item.transactions?.length>0&&(
                          <div className="data-card-row"><span className="data-card-label">Pengguna</span><span className="data-card-value text-[#818cf8]">{item.transactions.slice(0,2).map(t=>t.user?.name).filter(Boolean).join(", ")}</span></div>
                        )}
                        <div className="data-card-row"><span className="data-card-label">Ditambahkan</span><span className="data-card-value">{item.createdAt?new Date(item.createdAt).toLocaleDateString("id-ID"):"-"}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="px-4 md:px-6 py-4 border-t border-[rgba(99,102,241,0.08)]">
                <p className="text-sm text-[var(--text-muted)]">Total {data?.total||0} akun</p>
              </div>
            </>
          )}
        </div>
      </div>

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

              {/* Tipe Produk */}
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

              {/* Slot Pengguna */}
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

              {/* Tipe Produk Bulk */}
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

              {/* Slot Pengguna Bulk */}
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
    </>
  );
}
