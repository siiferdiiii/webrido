"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Referral {
  id: string;
  name: string;
  email: string; // Already masked from API
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
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white">Referral Saya</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Daftar customer yang mendaftar dari link affiliate kamu ({total} total)
        </p>
      </div>

      <div className="px-8 pb-8 space-y-5">
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="search-box flex-1 max-w-md">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Cari nama referral..."
              className="form-input !pl-10"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-emerald-400" size={32} />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-16">
              <Users size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <p className="text-[var(--text-secondary)]">Belum ada referral</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Share link affiliate kamu untuk mulai dapat customer</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
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
              <div className="sm:hidden data-card-grid">
                {referrals.map(r => (
                  <div key={r.id} className="data-card">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-white">{r.name}</p>
                      <span className={`badge text-[10px] ${r.subscriptionStatus === "active" ? "badge-success" : "badge-neutral"}`}>
                        {r.subscriptionStatus === "active" ? "Aktif" : "Inaktif"}
                      </span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Email</span>
                      <span className="data-card-value font-mono text-[var(--text-muted)]">{r.email}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Bergabung</span>
                      <span className="data-card-value">{new Date(r.createdAt).toLocaleDateString("id-ID")}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Total Trx</span>
                      <span className="data-card-value font-medium">{r.totalTransactions}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Total Belanja</span>
                      <span className="data-card-value text-emerald-400 font-semibold">Rp {fmt(r.totalSpent)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 p-4 border-t border-[var(--border-color)]">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-icon"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-[var(--text-secondary)]">
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
