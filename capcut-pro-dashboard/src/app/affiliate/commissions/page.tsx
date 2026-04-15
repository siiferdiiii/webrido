"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Commission {
  id: string;
  amount: number;
  transactionAmount: number;
  status: string;
  createdAt: string;
  user?: { name: string } | null;
  transaction?: { productName: string | null; amount: number; purchaseDate: string | null } | null;
}

export default function AffiliateCommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", page.toString());
    const res = await fetch(`/api/affiliate-portal/commissions?${params}`);
    const data = await res.json();
    setCommissions(data.commissions || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

  // Calculate totals
  const totalEarned = commissions.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div>
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white">Riwayat Komisi</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Detail komisi dari setiap transaksi referral ({total} total)
        </p>
      </div>

      <div className="px-8 pb-8 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="glass-card p-4 text-center">
            <p className="text-xl font-bold text-emerald-400">Rp {fmt(totalEarned)}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Total di halaman ini</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xl font-bold text-amber-400">{total}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Total komisi</p>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-emerald-400" size={32} />
            </div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-16">
              <Coins size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <p className="text-[var(--text-secondary)]">Belum ada riwayat komisi</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Customer</th>
                      <th>Produk</th>
                      <th>Nilai Transaksi</th>
                      <th>Komisi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map(c => (
                      <tr key={c.id}>
                        <td className="text-sm">{new Date(c.createdAt).toLocaleDateString("id-ID")}</td>
                        <td className="font-medium text-white">{c.user?.name || "—"}</td>
                        <td className="text-sm text-[var(--text-secondary)]">{c.transaction?.productName || "—"}</td>
                        <td className="text-sm">Rp {fmt(Number(c.transactionAmount))}</td>
                        <td className="text-emerald-400 font-bold">+Rp {fmt(Number(c.amount))}</td>
                        <td>
                          <span className={`badge ${c.status === "credited" ? "badge-success" : c.status === "withdrawn" ? "badge-neutral" : "badge-warning"}`}>
                            {c.status === "credited" ? "Dikreditkan" : c.status === "withdrawn" ? "Ditarik" : c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden data-card-grid">
                {commissions.map(c => (
                  <div key={c.id} className="data-card">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white">{c.user?.name || "—"}</p>
                      <span className="text-sm font-bold text-emerald-400">+Rp {fmt(Number(c.amount))}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Produk</span>
                      <span className="data-card-value text-[var(--text-secondary)]">{c.transaction?.productName || "—"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Nilai Trx</span>
                      <span className="data-card-value">Rp {fmt(Number(c.transactionAmount))}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Tanggal</span>
                      <span className="data-card-value">{new Date(c.createdAt).toLocaleDateString("id-ID")}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Status</span>
                      <span className={`badge text-[10px] ${c.status === "credited" ? "badge-success" : "badge-neutral"}`}>
                        {c.status === "credited" ? "Dikreditkan" : c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 p-4 border-t border-[var(--border-color)]">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-icon">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-[var(--text-secondary)]">
                    Halaman {page} dari {totalPages}
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
  );
}
