"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Referral {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  subscriptionStatus: string;
  totalTransactions: number;
  totalSpent: number;
}

export default function AffiliateReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", page.toString());
    if (search) params.set("search", search);
    const res = await fetch(`/api/affiliate-portal/referrals?${params}`);
    const data = await res.json();
    setReferrals(data.referrals || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  return (
    <div>
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Referral Saya</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
          Daftar customer dari link affiliate kamu ({total} total)
        </p>
      </div>

      <div className="px-4 sm:px-8 pb-8 space-y-4 sm:space-y-5">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Cari nama referral..."
            className="form-input w-full !pl-10 text-sm"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Table / Cards */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 sm:py-20">
              <Loader2 className="animate-spin text-emerald-400" size={28} />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <Users size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">Belum ada referral</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Share link affiliate kamu untuk mulai</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Email</th>
                      <th>Bergabung</th>
                      <th>Status</th>
                      <th>Total Trx</th>
                      <th>Total Belanja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map(r => (
                      <tr key={r.id}>
                        <td className="font-medium text-white">{r.name}</td>
                        <td className="text-sm text-[var(--text-muted)] font-mono">{r.email}</td>
                        <td className="text-sm">{new Date(r.createdAt).toLocaleDateString("id-ID")}</td>
                        <td>
                          <span className={`badge ${r.subscriptionStatus === "active" ? "badge-success" : "badge-neutral"}`}>
                            {r.subscriptionStatus === "active" ? "Aktif" : "Inaktif"}
                          </span>
                        </td>
                        <td className="font-medium">{r.totalTransactions}</td>
                        <td className="text-emerald-400 font-medium">Rp {fmt(r.totalSpent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-[rgba(99,102,241,0.06)]">
                {referrals.map(r => (
                  <div key={r.id} className="px-4 py-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">{r.email}</p>
                      </div>
                      <span className={`badge text-[10px] flex-shrink-0 ${r.subscriptionStatus === "active" ? "badge-success" : "badge-neutral"}`}>
                        {r.subscriptionStatus === "active" ? "Aktif" : "Inaktif"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--text-muted)]">
                          Bergabung: {new Date(r.createdAt).toLocaleDateString("id-ID")}
                        </span>
                        <span className="text-[var(--text-muted)]">{r.totalTransactions} Trx</span>
                      </div>
                      <span className="text-emerald-400 font-semibold">Rp {fmt(r.totalSpent)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 p-3 sm:p-4 border-t border-[var(--border-color)]">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-icon"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs sm:text-sm text-[var(--text-secondary)]">
                    Halaman {page} dari {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn-icon"
                  >
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
