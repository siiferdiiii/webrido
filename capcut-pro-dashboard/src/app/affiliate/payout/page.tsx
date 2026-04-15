"use client";

import { useState, useEffect, useCallback } from "react";
import { useAffiliateAuth } from "@/context/AffiliateAuthContext";
import {
  Wallet,
  Loader2,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Banknote,
} from "lucide-react";

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
}

const MIN_PAYOUT = 25000;

export default function AffiliatePayoutPage() {
  const { user, refetch } = useAffiliateAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [method, setMethod] = useState<"dana" | "bank_transfer">("dana");
  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", page.toString());
    const res = await fetch(`/api/affiliate-portal/payout?${params}`);
    const data = await res.json();
    setWithdrawals(data.withdrawals || []);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < MIN_PAYOUT) {
      setError(`Minimum payout Rp ${fmt(MIN_PAYOUT)}`);
      return;
    }
    if (!accountNumber) {
      setError("Nomor akun / HP wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate-portal/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, method, accountNumber, accountName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal request payout");
        return;
      }
      setSuccess(data.message || "Payout berhasil diajukan!");
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      refetch(); // Refresh balance
      fetchWithdrawals(); // Refresh history
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasPending = withdrawals.some(w => w.status === "pending");
  const balance = Number(user?.balance || 0);

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle size={14} className="text-emerald-400" />;
    if (status === "pending") return <Clock size={14} className="text-amber-400" />;
    if (status === "rejected") return <XCircle size={14} className="text-rose-400" />;
    return <Clock size={14} className="text-[var(--text-muted)]" />;
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return "badge-success";
    if (status === "pending") return "badge-warning";
    if (status === "rejected") return "badge-danger";
    return "badge-neutral";
  };

  const statusLabel = (status: string) => {
    if (status === "approved") return "Berhasil";
    if (status === "pending") return "Diproses";
    if (status === "rejected") return "Ditolak";
    return status;
  };

  return (
    <div>
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white">Tarik Saldo</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Request payout ke DANA atau Transfer Bank
        </p>
      </div>

      <div className="px-8 pb-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Payout Form */}
          <div className="lg:col-span-2">
            <div className="glass-card p-6 space-y-5">
              {/* Balance display */}
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))",
                  border: "1px solid rgba(16,185,129,0.25)",
                }}
              >
                <p className="text-xs text-emerald-400/70 uppercase tracking-wider font-semibold">Saldo Tersedia</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1">Rp {fmt(balance)}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2">Min. payout Rp {fmt(MIN_PAYOUT)}</p>
              </div>

              {hasPending && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-300">Ada payout yang masih diproses. Tunggu sampai selesai sebelum request lagi.</span>
                </div>
              )}

              <form onSubmit={handlePayout} className="space-y-4">
                {/* Method */}
                <div>
                  <label className="form-label">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMethod("dana")}
                      className={`p-3 rounded-xl text-sm font-medium transition-all text-center cursor-pointer ${
                        method === "dana"
                          ? "bg-[rgba(0,112,255,0.15)] border-[rgba(0,112,255,0.4)] text-blue-400"
                          : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]"
                      }`}
                      style={{ border: "1px solid" }}
                    >
                      💰 DANA
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("bank_transfer")}
                      className={`p-3 rounded-xl text-sm font-medium transition-all text-center cursor-pointer ${
                        method === "bank_transfer"
                          ? "bg-[rgba(16,185,129,0.15)] border-[rgba(16,185,129,0.4)] text-emerald-400"
                          : "bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]"
                      }`}
                      style={{ border: "1px solid" }}
                    >
                      🏦 Transfer Bank
                    </button>
                  </div>
                </div>

                {/* Account Number */}
                <div>
                  <label className="form-label">
                    {method === "dana" ? "Nomor DANA" : "Nomor Rekening"}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={method === "dana" ? "08xxxxxxxxxx" : "Nomor rekening bank"}
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                  />
                </div>

                {/* Account Name (for bank) */}
                {method === "bank_transfer" && (
                  <div>
                    <label className="form-label">Nama Pemilik Rekening & Bank</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: John Doe - BCA"
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                    />
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="form-label">Jumlah (Rp)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder={`Min. ${fmt(MIN_PAYOUT)}`}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min={MIN_PAYOUT}
                    max={balance}
                  />
                  {balance >= MIN_PAYOUT && (
                    <button
                      type="button"
                      onClick={() => setAmount(balance.toString())}
                      className="text-xs text-emerald-400 hover:underline mt-1 cursor-pointer"
                    >
                      Tarik semua (Rp {fmt(balance)})
                    </button>
                  )}
                </div>

                {error && (
                  <div className="px-3 py-2 rounded-xl text-sm text-rose-300" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div className="px-3 py-2 rounded-xl text-sm text-emerald-300" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || hasPending || balance < MIN_PAYOUT}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {submitting ? "Memproses..." : "Request Payout"}
                </button>
              </form>
            </div>
          </div>

          {/* Withdrawal History */}
          <div className="lg:col-span-3">
            <div className="glass-card overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--border-color)]">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Banknote size={16} className="text-emerald-400" />
                  Riwayat Penarikan
                </h3>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-emerald-400" size={28} />
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center py-16">
                  <Wallet size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">Belum ada riwayat penarikan</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-[rgba(99,102,241,0.06)]">
                    {withdrawals.map(w => (
                      <div key={w.id} className="flex items-center justify-between px-6 py-4 hover:bg-[rgba(16,185,129,0.03)] transition-colors">
                        <div className="flex items-start gap-3">
                          {statusIcon(w.status)}
                          <div>
                            <p className="text-sm font-semibold text-rose-400">-Rp {fmt(Number(w.amount))}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{w.notes || "Tanpa catatan"}</p>
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
                              {new Date(w.createdAt).toLocaleDateString("id-ID")} • {new Date(w.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <span className={`badge text-[10px] ${statusBadge(w.status)}`}>
                          {statusLabel(w.status)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-4 border-t border-[var(--border-color)]">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-icon">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm text-[var(--text-secondary)]">
                        {page} / {totalPages}
                      </span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-icon">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
