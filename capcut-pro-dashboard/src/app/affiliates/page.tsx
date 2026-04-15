"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Plus,
  Search,
  X,
  UserPlus,
  Wallet,
  TrendingUp,
  Eye,
  Minus,
  Loader2,
  DollarSign,
  Users,
  ArrowDownCircle,
  ArrowUpDown,
  History,
  Link2,
  Copy,
  Check,
} from "lucide-react";

interface AffiliateItem {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  commissionRate: number;
  totalEarned: number;
  balance: number;
  status: string;
  createdAt: string;
  _count: { referredUsers: number; commissions: number; withdrawals: number };
}

interface Commission {
  id: string;
  amount: number;
  transactionAmount: number;
  status: string;
  createdAt: string;
  user?: { name: string; email: string } | null;
  transaction?: { id: string; amount: number; createdAt: string } | null;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface AffiliateDetail extends AffiliateItem {
  referredUsers: { id: string; name: string; email: string; whatsapp: string | null }[];
  commissions: Commission[];
  withdrawals: Withdrawal[];
}

type SortOption = "newest" | "referralDesc" | "referralAsc" | "balanceDesc" | "balanceAsc";

export default function AffiliatePage() {
  const { maskEmail, maskPhone } = usePrivacy();
  const [affiliates, setAffiliates] = useState<AffiliateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<AffiliateDetail | null>(null);
  const [showWithdraw, setShowWithdraw] = useState<AffiliateItem | null>(null);
  const [showWithdrawHistory, setShowWithdrawHistory] = useState<AffiliateItem | null>(null);
  
  const [formData, setFormData] = useState({ name: "", email: "", whatsapp: "", commissionRate: "10" });
  const [withdrawData, setWithdrawData] = useState({ amount: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Customer picker for referral
  const [showReferralPicker, setShowReferralPicker] = useState<string | null>(null); // holds affiliate ID
  const [customers, setCustomers] = useState<{ id: string; name: string; email: string; whatsapp: string | null; referredBy: string | null }[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Sorting logic
  const sortedAffiliates = [...affiliates].sort((a, b) => {
    if (sortBy === "referralDesc") return (b._count?.referredUsers || 0) - (a._count?.referredUsers || 0);
    if (sortBy === "referralAsc") return (a._count?.referredUsers || 0) - (b._count?.referredUsers || 0);
    if (sortBy === "balanceDesc") return Number(b.balance || 0) - Number(a.balance || 0);
    if (sortBy === "balanceAsc") return Number(a.balance || 0) - Number(b.balance || 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
  });

  const fetchAffiliates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/affiliates?${params}`);
    const data = await res.json();
    setAffiliates(data.affiliates || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchAffiliates(); }, [fetchAffiliates]);

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    const params = new URLSearchParams();
    if (customerSearch) params.set("search", customerSearch);
    params.set("limit", "50");
    const res = await fetch(`/api/users?${params}`);
    const data = await res.json();
    setCustomers(data.users || []);
    setLoadingCustomers(false);
  }, [customerSearch]);

  useEffect(() => {
    if (showReferralPicker) fetchCustomers();
  }, [showReferralPicker, fetchCustomers]);

  const handleCreate = async () => {
    if (!formData.name) return;
    setSubmitting(true);
    await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, commissionRate: parseFloat(formData.commissionRate) || 10 }),
    });
    setShowForm(false);
    setFormData({ name: "", email: "", whatsapp: "", commissionRate: "10" });
    setSubmitting(false);
    fetchAffiliates();
  };

  const handleViewDetail = async (id: string) => {
    const res = await fetch(`/api/affiliates/${id}`);
    const data = await res.json();
    setShowDetail(data.affiliate);
  };

  const handleWithdraw = async () => {
    if (!showWithdraw || !withdrawData.amount) return;
    setSubmitting(true);
    const res = await fetch(`/api/affiliates/${showWithdraw.id}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(withdrawData.amount), notes: withdrawData.notes }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
    }
    setShowWithdraw(null);
    setWithdrawData({ amount: "", notes: "" });
    setSubmitting(false);
    fetchAffiliates();
    if (showDetail) handleViewDetail(showDetail.id);
  };

  const handleAddReferral = async (userId: string) => {
    if (!showReferralPicker) return;
    setSubmitting(true);
    const res = await fetch(`/api/affiliates/${showReferralPicker}/referrals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
    } else {
      setShowReferralPicker(null);
      setCustomerSearch("");
      fetchAffiliates();
      if (showDetail) handleViewDetail(showDetail.id);
    }
    setSubmitting(false);
  };

  const totalBalance = affiliates.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalEarned = affiliates.reduce((sum, a) => sum + Number(a.totalEarned || 0), 0);
  const totalReferrals = affiliates.reduce((sum, a) => sum + (a._count?.referredUsers || 0), 0);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div>
      <Topbar title="Affiliate" subtitle="Kelola mitra affiliate dan komisi mereka" />

      <div className="px-8 pb-8 space-y-5">
        {/* Mini Stats (Samakan dengan stok akun) */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">Rp {fmt(totalBalance)}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total Saldo Affiliate</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-[#818cf8]">Rp {fmt(totalEarned)}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total Komisi (All Time)</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{totalReferrals}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total Referral Customer</p>
          </div>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="search-box flex-1 max-w-md">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Cari affiliate..." className="form-input !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            
            <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 min-w-[200px] h-[42px]">
              <ArrowUpDown size={14} className="text-[var(--text-muted)]" />
              <select 
                className="bg-transparent text-sm text-[var(--text-secondary)] outline-none w-full appearance-none cursor-pointer"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="newest" className="bg-[#1e1e2d]">Terbaru</option>
                <option value="referralDesc" className="bg-[#1e1e2d]">Referral Terbanyak</option>
                <option value="referralAsc" className="bg-[#1e1e2d]">Referral Paling Sedikit</option>
                <option value="balanceDesc" className="bg-[#1e1e2d]">Saldo Tertinggi</option>
                <option value="balanceAsc" className="bg-[#1e1e2d]">Saldo Terendah</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Tambah Affiliate</button>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[var(--accent)]" size={32} /></div>
          ) : sortedAffiliates.length === 0 ? (
            <div className="card text-center py-16">
              <UserPlus size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <p className="text-[var(--text-secondary)]">Belum ada affiliate</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>WA</th>
                <th>Komisi %</th>
                <th>Total Earned</th>
                <th>Saldo</th>
                <th>Referral</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedAffiliates.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-white">{a.name}</td>
                  <td className="text-sm">{maskEmail(a.email)}</td>
                  <td className="text-sm font-mono">{maskPhone(a.whatsapp)}</td>
                  <td><span className="badge badge-primary">{a.commissionRate}%</span></td>
                  <td className="text-green-400 font-medium">Rp {fmt(Number(a.totalEarned || 0))}</td>
                  <td className="text-yellow-400 font-bold">Rp {fmt(Number(a.balance || 0))}</td>
                  <td>
                    <button 
                      onClick={() => handleViewDetail(a.id)}
                      className="flex items-center gap-1.5 hover:text-white transition-colors group cursor-pointer"
                    >
                      <Users size={14} className="text-[var(--text-muted)] group-hover:text-white" />
                      <span className="font-medium">{a._count?.referredUsers || 0}</span>
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={async () => {
                        const res = await fetch(`/api/affiliates/${a.id}/invite`, { method: 'POST' });
                        const data = await res.json();
                        if (data.inviteUrl) {
                          setInviteLink(data.inviteUrl);
                          navigator.clipboard.writeText(data.inviteUrl);
                          setInviteCopied(true);
                          setTimeout(() => { setInviteCopied(false); setInviteLink(null); }, 3000);
                        } else { alert(data.error || 'Gagal generate invite link'); }
                      }} className="btn-icon hover:bg-[rgba(16,185,129,0.15)] hover:text-emerald-400" title="Generate Invite Link">
                        <Link2 size={16} />
                      </button>
                      <button onClick={() => { setShowWithdrawHistory(a); handleViewDetail(a.id); }} className="btn-icon" title="Riwayat Penarikan Saldo">
                        <History size={16} />
                      </button>
                      <button onClick={() => handleViewDetail(a.id)} className="btn-icon hover:bg-[rgba(99,102,241,0.15)] hover:text-white" title="Lihat Detail Pelanggan">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => { setShowWithdraw(a); setWithdrawData({ amount: "", notes: "" }); }}
                        className="btn-icon hover:bg-[rgba(239,68,68,0.15)] hover:text-red-400" title="Tarik Saldo">
                        <Minus size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </div>
      </div>

      {/* Modal Detail */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal-content" style={{ maxWidth: 768 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="text-lg font-bold text-white">{showDetail.name}</h3>
                <p className="text-xs text-[var(--text-muted)]">{maskEmail(showDetail.email)} • {maskPhone(showDetail.whatsapp) || "No WA"}</p>
              </div>
              <button className="btn-icon" onClick={() => setShowDetail(null)}><X size={18} /></button>
            </div>

            <div className="modal-body space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <p className="text-xs text-[var(--text-muted)]">Total Earned</p>
                  <p className="text-lg font-bold text-green-400">Rp {fmt(Number(showDetail.totalEarned || 0))}</p>
                </div>
                <div className="p-3 rounded-xl text-center" style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)" }}>
                  <p className="text-xs text-[var(--text-muted)]">Saldo</p>
                  <p className="text-lg font-bold text-yellow-400">Rp {fmt(Number(showDetail.balance || 0))}</p>
                </div>
                <div className="p-3 rounded-xl text-center" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <p className="text-xs text-[var(--text-muted)]">Referral</p>
                  <p className="text-lg font-bold text-[var(--accent)]">{showDetail.referredUsers?.length || 0}</p>
                </div>
              </div>

              {/* Referred Users */}
              {showDetail.referredUsers?.length >= 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Customer Referral ({showDetail.referredUsers?.length || 0})</p>
                    <button onClick={() => setShowReferralPicker(showDetail.id)} className="badge badge-info cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 py-1">
                      <Plus size={12} /> Tambah Referral
                    </button>
                  </div>
                  {showDetail.referredUsers?.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2 rounded-xl p-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                      {showDetail.referredUsers.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[rgba(99,102,241,0.06)] transition-colors">
                          <span className="text-sm font-medium text-white">{u.name}</span>
                          <span className="text-xs font-mono text-[var(--text-muted)]">{maskEmail(u.email)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                      <p className="text-xs text-[var(--text-muted)]">Belum ada pelanggan dari referral ini.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Commissions */}
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Riwayat Komisi ({showDetail.commissions?.length || 0})</p>
                {showDetail.commissions?.length ? (
                  <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-2 rounded-xl p-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                    {showDetail.commissions.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[rgba(34,197,94,0.06)] transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{c.user?.name || "—"}</p>
                          <p className="text-xs text-[var(--text-muted)]">Transaksi Rp {fmt(Number(c.transactionAmount))}</p>
                        </div>
                        <span className="text-sm font-bold text-green-400 flex-shrink-0 ml-4">+Rp {fmt(Number(c.amount))}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-[var(--text-muted)] bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] text-center">Belum ada komisi</p>}
              </div>

              {/* Withdrawals */}
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Riwayat Withdraw ({showDetail.withdrawals?.length || 0})</p>
                {showDetail.withdrawals?.length ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2 rounded-xl p-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                    {showDetail.withdrawals.map((w) => (
                      <div key={w.id} className="flex items-start justify-between p-2.5 rounded-lg hover:bg-[rgba(244,63,94,0.06)] transition-colors">
                        <div className="min-w-0 pr-4">
                          <p className="text-sm font-medium text-rose-400">-Rp {fmt(Number(w.amount))}</p>
                          {w.notes && <p className="text-xs text-[var(--text-muted)] mt-0.5">{w.notes}</p>}
                        </div>
                        <span className="text-xs font-mono text-[var(--text-muted)] flex-shrink-0">{new Date(w.createdAt).toLocaleDateString("id-ID")}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-[var(--text-muted)] bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] text-center">Belum ada riwayat withdraw</p>}
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetail(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Riwayat Withdraw */}
      {showWithdrawHistory && showDetail && (showDetail.id === showWithdrawHistory.id) && (
        <div className="modal-overlay" onClick={() => setShowWithdrawHistory(null)} style={{ zIndex: 60 }}>
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white">Riwayat Tarik Saldo</h3>
              <button className="btn-icon" onClick={() => setShowWithdrawHistory(null)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="mb-4">
                <p className="text-sm text-[var(--text-secondary)]">Affiliate: <span className="font-medium text-white">{showWithdrawHistory.name}</span></p>
                <p className="text-sm text-[var(--text-secondary)] mb-4">Saldo Saat Ini: <span className="text-yellow-400 font-bold">Rp {fmt(Number(showWithdrawHistory.balance || 0))}</span></p>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
                {showDetail.withdrawals?.length > 0 ? (
                  showDetail.withdrawals.map((w) => (
                    <div key={w.id} className="p-3 rounded-xl flex items-start justify-between" style={{ background: "rgba(244,63,94,0.05)", border: "1px solid rgba(244,63,94,0.15)" }}>
                      <div>
                        <p className="text-base font-bold text-rose-400">-Rp {fmt(Number(w.amount))}</p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">{w.notes || "Tanpa catatan"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--text-muted)] font-mono">{new Date(w.createdAt).toLocaleDateString("id-ID")}</p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">{new Date(w.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                    <History size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-50" />
                    <p className="text-sm text-[var(--text-muted)]">Belum ada riwayat penarikan saldo</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary w-full" onClick={() => setShowWithdrawHistory(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Withdraw (Kurangi Saldo) */}
      {showWithdraw && (
        <div className="modal-overlay" onClick={() => setShowWithdraw(null)} style={{ zIndex: 60 }}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white">Tarik Saldo Affiliate</h3>
              <button className="btn-icon" onClick={() => setShowWithdraw(null)}><X size={16} /></button>
            </div>

            <div className="modal-body space-y-4">
              <div className="p-4 rounded-xl" style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)" }}>
                <p className="text-sm text-[var(--text-secondary)] mb-1">Affiliate: <span className="font-medium text-white">{showWithdraw.name}</span></p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-secondary)]">Saldo Tersedia:</span>
                  <span className="text-lg font-bold text-yellow-400">Rp {fmt(Number(showWithdraw.balance || 0))}</span>
                </div>
              </div>

              <div>
                <label className="form-label">Jumlah (Rp)</label>
                <input type="number" className="form-input" placeholder="Contoh: 50000"
                  value={withdrawData.amount} onChange={(e) => setWithdrawData({ ...withdrawData, amount: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Catatan (opsional)</label>
                <input type="text" className="form-input" placeholder="Transfer BCA, e-wallet, dll"
                  value={withdrawData.notes} onChange={(e) => setWithdrawData({ ...withdrawData, notes: e.target.value })} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowWithdraw(null)}>Batal</button>
              <button onClick={handleWithdraw} disabled={submitting || !withdrawData.amount}
                className="btn-primary gap-2 disabled:opacity-50 !bg-rose-500 hover:!bg-rose-600 !border-rose-400">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownCircle size={16} />}
                {submitting ? "Memproses..." : "Tarik Saldo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Affiliate */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-bold text-white">Tambah Affiliate</h3>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="form-label">Nama *</label>
                <input type="text" className="form-input" placeholder="Nama lengkap affiliate"
                  value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Email <span className="text-[10px] text-[var(--text-muted)] font-normal ml-1">(harus sama dgn di Lynk.id)</span></label>
                <input type="email" className="form-input" placeholder="affiliate@email.com"
                  value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="form-label">WhatsApp</label>
                <input type="text" className="form-input" placeholder="08xxxxxxxxxx"
                  value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Komisi per item (%)</label>
                <input type="number" className="form-input" placeholder="10"
                  value={formData.commissionRate} onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button onClick={handleCreate} disabled={submitting || !formData.name}
                className="btn-primary gap-2 disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {submitting ? "Menyimpan..." : "Tambah Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Link Toast */}
      {inviteLink && (
        <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease]">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', backdropFilter: 'blur(12px)' }}>
            {inviteCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-emerald-400" />}
            <span className="text-sm text-emerald-300">Invite link berhasil disalin!</span>
          </div>
        </div>
      )}

      {/* Modal Pilih Customer Referral */}
      {showReferralPicker && (
        <div className="modal-overlay" style={{ zIndex: 70 }} onClick={() => setShowReferralPicker(null)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white">Pilih Customer untuk Referral</h3>
              <button className="btn-icon" onClick={() => setShowReferralPicker(null)}><X size={16} /></button>
            </div>

            <div className="modal-body" style={{ padding: "16px 24px" }}>
              {/* Search */}
              <div className="search-box mb-3">
                <Search size={14} className="search-icon" />
                <input type="text" className="form-input !pl-9 !py-2 text-sm" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Cari nama atau nomor..." />
              </div>

              {/* List */}
              <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-[var(--accent-indigo)]" size={20} /></div>
                ) : customers.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-muted)] py-8">Tidak ada customer ditemukan</p>
                ) : (
                  customers.map((c) => {
                    // Cek apakan customer sudah dimiliki affiliate
                    const isAlreadyReferred = c.referredBy !== null;
                    const isMine = c.referredBy === showReferralPicker;

                    return (
                      <div key={c.id} className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all hover:bg-[rgba(99,102,241,0.06)]"
                        style={{ border: "1px solid var(--border-color)", opacity: isAlreadyReferred ? 0.6 : 1 }}>
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate">{maskPhone(c.whatsapp) || "Tanpa WA"} · {maskEmail(c.email)}</p>
                        </div>

                        {isMine ? (
                          <span className="badge badge-success text-[10px] flex-shrink-0">✓ Tersambung</span>
                        ) : isAlreadyReferred ? (
                          <span className="badge badge-neutral text-[10px] flex-shrink-0">Terkait org lain</span>
                        ) : (
                          <button onClick={() => handleAddReferral(c.id)} disabled={submitting}
                            className="btn-primary flex-shrink-0 !px-2 !py-1 text-[11px]">
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : "Jadikan Referral"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary w-full" onClick={() => setShowReferralPicker(null)}>
                Tutup Pilihan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
