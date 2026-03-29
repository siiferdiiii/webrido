"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

interface WarrantyItem {
  id: string;
  claimReason: string | null;
  status: string | null;
  createdAt: string | null;
  transaction: {
    id: string;
    lynkIdRef: string | null;
    user: { name: string; whatsapp: string | null } | null;
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

      <div className="px-8 pb-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="search-box flex-1 max-w-md">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Cari nama, ID transaksi, atau nomor WA..." className="form-input !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => setShowClaimModal(true)}>
            <ShieldCheck size={16} /> Proses Klaim Baru
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#818cf8]" /><span className="ml-2 text-[var(--text-secondary)]">Memuat...</span></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Transaksi</th>
                      <th>Pelanggan</th>
                      <th>Akun Lama → Baru</th>
                      <th>Alasan</th>
                      <th>Status</th>
                      <th>Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-[var(--text-muted)]">Belum ada klaim garansi</td></tr>
                    ) : (
                      claims.map((claim) => (
                        <tr key={claim.id}>
                          <td className="font-mono text-sm text-[#818cf8]">{claim.transaction?.lynkIdRef || claim.transaction?.id?.substring(0, 8) || "-"}</td>
                          <td>
                            <p className="font-medium">{claim.transaction?.user?.name || "-"}</p>
                            <p className="text-xs text-[var(--text-muted)]">{maskPhone(claim.transaction?.user?.whatsapp)}</p>
                          </td>
                          <td>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-rose-400 font-mono">{claim.oldAccount?.accountEmail || "—"}</span>
                              <ArrowRight size={14} className="text-[var(--text-muted)]" />
                              <span className="text-emerald-400 font-mono">{claim.newAccount?.accountEmail || "—"}</span>
                            </div>
                          </td>
                          <td className="text-[var(--text-secondary)] text-sm max-w-[200px] truncate">{claim.claimReason || "-"}</td>
                          <td>{getClaimBadge(claim.status)}</td>
                          <td className="text-[var(--text-secondary)] text-sm">{claim.createdAt ? new Date(claim.createdAt).toLocaleDateString("id-ID") : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(99,102,241,0.08)]">
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
                  <p className="text-xs text-[var(--text-muted)]">Akun lama sudah otomatis di-banned. Kirim data akun baru ke pelanggan.</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-300">Perhatian</p>
                        <p className="text-[var(--text-secondary)] mt-1">Proses ini akan otomatis mengambil 1 stok akun baru, mengubah akun lama menjadi &quot;banned&quot;, dan menyiapkan akun baru untuk dikirim ke pelanggan.</p>
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
    </>
  );
}
