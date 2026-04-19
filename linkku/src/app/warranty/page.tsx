"use client";

import { useState, useEffect, useCallback } from "react";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Search,
  ShieldCheck,
  AlertTriangle,
  X,
  Check,
  ArrowRight,
  Loader2,
  LayoutList,
  LayoutGrid,
  User,
  Receipt
} from "lucide-react";

interface TransactionHistory {
  id: string;
  purchaseDate: string | null;
  amount: number;
  status: string;
  stockAccount: { accountEmail: string; productType: string } | null;
  warrantyClaims: { id: string; status: string }[];
}

interface WarrantyItem {
  id: string;
  claimReason: string | null;
  status: string | null;
  createdAt: string | null;
  transaction: {
    id: string;
    lynkIdRef: string | null;
    user: { id: string; name: string; whatsapp: string | null } | null;
    warrantyClaims?: { id: string }[];
  } | null;
  oldAccount: { accountEmail: string } | null;
  newAccount: { accountEmail: string; accountPassword: string } | null;
}

function getClaimBadge(status: string | null) {
  switch (status) {
    case "resolved": return <span className="badge badge-success">Selesai</span>;
    case "pending": return <span className="badge badge-warning">Pending</span>;
    case "rejected": return <span className="badge badge-danger">Ditolak</span>;
    default: return <span className="badge badge-neutral">{status}</span>;
  }
}

export default function WarrantyPage() {
  const { maskPhone } = usePrivacy();
  const [claims, setClaims] = useState<WarrantyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimForm, setClaimForm] = useState({ transactionId: "", claimReason: "" });
  const [claimResult, setClaimResult] = useState<{ newAccount?: { email: string; password: string }; message?: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [userTransactions, setUserTransactions] = useState<TransactionHistory[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [accLoading, setAccLoading] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("id-ID") : "-";

  async function handleOpenUser(user: { id: string; name: string }) {
    setSelectedUser(user);
    setShowUserModal(true);
    setLoadingUser(true);
    try {
      const res = await fetch(`/api/users/${user.id}/transactions`);
      const json = await res.json();
      if (res.ok) {
        setUserTransactions(json.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUser(false);
    }
  }

  async function handleAcc(transactionId: string) {
    if (!confirm("Proses ACC garansi untuk transaksi ini?")) return;
    setAccLoading(transactionId);
    try {
      const res = await fetch("/api/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const json = await res.json();
      if (res.ok) {
        alert("Berhasil ACC! Akun baru: " + json.newAccount?.email);
        fetchData();
        if (selectedUser) handleOpenUser(selectedUser);
      } else {
        alert(json.error || "Gagal memproses klaim");
      }
    } catch {
      alert("Koneksi error");
    } finally {
      setAccLoading(null);
    }
  }

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/warranty?${params}`)
      .then((res) => res.json())
      .then((json) => { setClaims(json.claims || []); setTotal(json.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Real-time: auto-refresh when warranty claims change ──
  useRealtimeTable({
    table: "warranty_claims",
    onUpdate: fetchData,
  });

  async function handleClaim() {
    if (!claimForm.transactionId) return;
    setSubmitting(true);
    setClaimResult(null);
    try {
      const res = await fetch("/api/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimForm),
      });
      const json = await res.json();
      if (res.ok) {
        setClaimResult({ newAccount: json.newAccount, message: json.message });
        fetchData();
      } else {
        setClaimResult({ message: json.error });
      }
    } catch { setClaimResult({ message: "Koneksi error" }); }
    setSubmitting(false);
  }

  function closeModal() {
    setShowClaimModal(false);
    setClaimForm({ transactionId: "", claimReason: "" });
    setClaimResult(null);
  }

  return (
    <>
      <Topbar title="Klaim Garansi" subtitle="Kelola klaim garansi dan penggantian akun pelanggan" />

      <div className="px-4 md:px-8 pb-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="search-box flex-1 max-w-md">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Cari nama, ID transaksi, atau nomor WA..." className="form-input !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => setShowClaimModal(true)}>
            <ShieldCheck size={16} /> Proses Klaim Baru
          </button>
        </div>

        {/* View Toggle mobile */}
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-xs text-[var(--text-muted)]">Total {total} klaim</p>
          <div className="flex gap-1">
            <button className={`view-toggle-btn ${viewMode==='table'?'active':''}`} onClick={()=>setViewMode('table')}><LayoutList size={13}/> Tabel</button>
            <button className={`view-toggle-btn ${viewMode==='card'?'active':''}`} onClick={()=>setViewMode('card')}><LayoutGrid size={13}/> Card</button>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#818cf8]"/><span className="ml-2 text-[var(--text-secondary)]">Memuat...</span></div>
          ) : (
            <>
              {viewMode==='table' && (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr>
                      <th>Transaksi</th>
                      <th>Pelanggan</th>
                      <th>Akun Lama → Baru</th>
                      <th>Alasan</th>
                      <th>Tanggal</th>
                      <th className="sticky-col-head">Aksi</th>
                    </tr></thead>
                    <tbody>
                      {claims.length===0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-[var(--text-muted)]">Belum ada klaim garansi</td></tr>
                      ) : claims.map((claim)=>{
                        const claimIndex = claim.transaction?.warrantyClaims ? claim.transaction.warrantyClaims.findIndex(c => c.id === claim.id) + 1 : 0;
                        return (
                        <tr key={claim.id}>
                          <td className="font-mono text-sm text-[#818cf8]">
                            {claim.transaction?.lynkIdRef||claim.transaction?.id?.substring(0,8)||"-"}
                            {claimIndex > 0 && <span className="block mt-1 text-[10px] bg-[rgba(99,102,241,0.15)] text-[#a5b4fc] px-1.5 py-0.5 rounded w-max border border-[rgba(99,102,241,0.2)]">Klaim ke-{claimIndex}</span>}
                          </td>
                          <td><p className="font-medium">{claim.transaction?.user?.name||"-"}</p><p className="text-xs text-[var(--text-muted)]">{maskPhone(claim.transaction?.user?.whatsapp)}</p></td>
                          <td>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-rose-400 font-mono">{claim.oldAccount?.accountEmail||"—"}</span>
                              <ArrowRight size={12} className="text-[var(--text-muted)] flex-shrink-0"/>
                              <span className="text-emerald-400 font-mono">{claim.newAccount?.accountEmail||"—"}</span>
                            </div>
                          </td>
                          <td className="text-[var(--text-secondary)] text-sm max-w-[160px] truncate">{claim.claimReason||"-"}</td>
                          <td className="text-[var(--text-secondary)] text-sm">{claim.createdAt?new Date(claim.createdAt).toLocaleDateString("id-ID"):"-"}</td>
                          <td className="sticky-col-body">
                            <div className="flex items-center gap-2">
                              {getClaimBadge(claim.status)}
                              {claim.transaction?.user?.id && (
                                <button
                                  className="btn-secondary !py-1 !px-2 text-xs flex items-center gap-1"
                                  onClick={() => handleOpenUser({ id: claim.transaction!.user!.id, name: claim.transaction!.user!.name })}
                                >
                                  <User size={12} /> Cek User
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
              {viewMode==='card' && (
                <div className="data-card-grid">
                  {claims.length===0 ? <p className="text-center py-8 text-[var(--text-muted)]">Belum ada klaim garansi</p> : claims.map((claim)=>{
                    const claimIndex = claim.transaction?.warrantyClaims ? claim.transaction.warrantyClaims.findIndex(c => c.id === claim.id) + 1 : 0;
                    return (
                    <div key={claim.id} className="data-card">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-semibold text-white text-sm truncate">{claim.transaction?.user?.name||"-"}</p>
                          <p className="text-xs text-[var(--text-muted)]">{maskPhone(claim.transaction?.user?.whatsapp)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getClaimBadge(claim.status)}
                          {claim.transaction?.user?.id && (
                            <button
                              className="btn-secondary !py-1 !px-2 text-xs flex items-center gap-1"
                              onClick={() => handleOpenUser({ id: claim.transaction!.user!.id, name: claim.transaction!.user!.name })}
                            >
                              <User size={12} /> Cek User
                            </button>
                          )}
                          {getClaimBadge(claim.status)}
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-2.5 border-t border-[rgba(99,102,241,0.08)]">
                        <div className="data-card-row"><span className="data-card-label">ID Transaksi</span><span className="data-card-value font-mono text-xs text-[#818cf8]">{claim.transaction?.lynkIdRef||claim.transaction?.id?.substring(0,8)||"-"}</span></div>
                        <div className="data-card-row"><span className="data-card-label">Urutan</span><span className="data-card-value">Klaim ke-{claimIndex > 0 ? claimIndex : "-"}</span></div>
                        <div className="data-card-row"><span className="data-card-label">Akun Lama</span><span className="data-card-value font-mono text-xs text-rose-400">{claim.oldAccount?.accountEmail||"—"}</span></div>
                        <div className="data-card-row"><span className="data-card-label">Akun Baru</span><span className="data-card-value font-mono text-xs text-emerald-400">{claim.newAccount?.accountEmail||"—"}</span></div>
                        <div className="data-card-row"><span className="data-card-label">Alasan</span><span className="data-card-value">{claim.claimReason||"-"}</span></div>
                        <div className="data-card-row"><span className="data-card-label">Tanggal</span><span className="data-card-value">{claim.createdAt?new Date(claim.createdAt).toLocaleDateString("id-ID"):"-"}</span></div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
              <div className="px-4 md:px-6 py-4 border-t border-[rgba(99,102,241,0.08)]">
                <p className="text-sm text-[var(--text-muted)]">Total {total} klaim garansi</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Klaim */}
      {showClaimModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2"><ShieldCheck size={20} className="text-[#818cf8]" /> Proses Klaim Garansi</h3>
              <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
            </div>
            <div className="modal-body space-y-4">
              {claimResult?.newAccount ? (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                  <p className="font-semibold text-emerald-300">✅ {claimResult.message}</p>
                  <div className="bg-[var(--bg-primary)] rounded-lg p-3 font-mono text-sm space-y-1">
                    <p><span className="text-[var(--text-muted)]">Email Baru:</span> <span className="text-white">{claimResult.newAccount.email}</span></p>
                    <p><span className="text-[var(--text-muted)]">Password:</span> <span className="text-white">{claimResult.newAccount.password}</span></p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Slot akun lama sudah dikurangi. Kirim data akun baru ke pelanggan.</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-300">Perhatian</p>
                        <p className="text-[var(--text-secondary)] mt-1">Proses ini akan otomatis mengambil 1 stok akun baru, mengurangi slot akun lama, dan menyiapkan akun baru untuk dikirim ke pelanggan. Satu transaksi dapat diklaim lebih dari 1 kali.</p>
                      </div>
                    </div>
                  </div>
                  <div><label className="form-label">ID Transaksi (UUID)</label><input type="text" className="form-input" placeholder="Paste UUID transaksi dari tabel" value={claimForm.transactionId} onChange={(e) => setClaimForm({ ...claimForm, transactionId: e.target.value })} /></div>
                  <div>
                    <label className="form-label">Alasan Klaim</label>
                    <select className="form-input" value={claimForm.claimReason} onChange={(e) => setClaimForm({ ...claimForm, claimReason: e.target.value })}>
                      <option value="">-- Pilih Alasan --</option>
                      <option value="Batas Limit Perangkat">Batas Limit Perangkat</option>
                      <option value="Akun Tidak Bisa Login">Akun Tidak Bisa Login</option>
                      <option value="Fitur Pro Tidak Aktif">Fitur Pro Tidak Aktif</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  {claimResult?.message && <p className="text-sm text-rose-400">{claimResult.message}</p>}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Tutup</button>
              {!claimResult?.newAccount && (
                <button className="btn-success" onClick={handleClaim} disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Proses & Ganti Akun
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    {/* Modal Histori Transaksi Pelanggan */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                <Receipt size={18} className="text-[#818cf8]" /> Histori Transaksi: {selectedUser.name}
              </h3>
              <button className="btn-icon" onClick={() => setShowUserModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {loadingUser ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[#818cf8]" /></div>
              ) : userTransactions.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">Belum ada histori transaksi.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Nominal</th>
                        <th>Akun (Email)</th>
                        <th>Status</th>
                        <th>Aksi Klaim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userTransactions.map(trx => {
                        const hasPendingClaim = trx.warrantyClaims?.some(c => c.status === "pending");
                        return (
                        <tr key={trx.id}>
                          <td className="text-[var(--text-secondary)]">{formatDate(trx.purchaseDate)}</td>
                          <td className="font-semibold">{formatCurrency(trx.amount)}</td>
                          <td className="font-mono text-xs text-[var(--text-secondary)]">
                            <span className="block text-white mb-0.5 capitalize">{trx.stockAccount?.productType || "-"}</span>
                            {trx.stockAccount?.accountEmail || "-"}
                          </td>
                          <td>
                            {trx.status === "success"
                              ? <span className="badge badge-success !text-[10px] !py-0.5">Sukses</span>
                              : <span className="badge badge-danger !text-[10px] !py-0.5">Gagal</span>}
                          </td>
                          <td>
                            {hasPendingClaim ? (
                              <button
                                className="btn-success !py-1 !px-2 text-xs flex items-center gap-1"
                                onClick={() => handleAcc(trx.id)}
                                disabled={accLoading === trx.id}
                              >
                                {accLoading === trx.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                ACC
                              </button>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]">Tidak ada pending</span>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowUserModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
