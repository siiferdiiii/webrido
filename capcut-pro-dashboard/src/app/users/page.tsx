"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Search,
  MessageCircle,
  Eye,
  Edit2,
  Loader2,
  X,
  Receipt,
  CheckSquare,
  Square,
  Send,
  Users,
} from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  name: string;
  whatsapp: string | null;
  customerType: string | null;
  subscriptionStatus: string | null;
  followUpStatus: string | null;
  createdAt: string | null;
  transactions: Array<{ purchaseDate: string | null; warrantyExpiredAt: string | null }>;
  _count: { transactions: number };
}

interface TransactionHistory {
  id: string;
  amount: number;
  status: string;
  purchaseDate: string;
  warrantyExpiredAt: string;
  stockAccount: {
    accountEmail: string;
    productType: string;
  } | null;
}

const filterOptions = ["Semua", "Aktif", "Tidak Aktif", "Follow Up 1", "Follow Up 2", "Follow Up 3", "Cold", "Project Only"];

const followUpTemplates: Record<string, string> = {
  follow_up_1: "Halo kak {name}! 👋 Kami notice masa aktif CapCut Pro kakak sudah habis nih. Mau perpanjang lagi? Pakai kode 'LOYAL10' dapet diskon 10%! 🔥",
  follow_up_2: "Hai kak {name}! Masih inget CapCut Pro? Banyak fitur baru lho yang sayang banget kalau kakak lewatin. Yuk perpanjang sebelum kehabisan slot! 💎",
  follow_up_3: "Kak {name}, jangan lewatkan promo terakhir kami! Diskon 15% khusus untuk kamu. Promo ini tidak akan terulang lagi! ⏰🔥",
  cold: "Halo kak {name}! Sudah lama banget nih kita nggak chat 😊 CapCut Pro lagi ada update besar! Mau coba lagi? Kami kasih harga spesial khusus kakak! ✨",
  project_only: "Hai kak {name}! Lagi ada project editing? CapCut Pro bisa bantu banget nih 💪 Ada paket 30 hari yang cocok buat project-based. Mau info lebih lanjut?",
};

function getNextFollowUp(current: string | null): string {
  switch (current) {
    case "none": case null: return "follow_up_1";
    case "follow_up_1": return "follow_up_2";
    case "follow_up_2": return "follow_up_3";
    case "follow_up_3": return "cold";
    default: return current;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID");
}

export default function UsersPage() {
  const { maskEmail, maskPhone } = usePrivacy();
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [sortBy, setSortBy] = useState("terbaru");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllDB, setSelectAllDB] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [userTransactions, setUserTransactions] = useState<TransactionHistory[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
  };

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filter === "Aktif") params.set("status", "active");
    else if (filter === "Tidak Aktif") params.set("status", "inactive");
    else if (filter === "Follow Up 1") params.set("followUp", "follow_up_1");
    else if (filter === "Follow Up 2") params.set("followUp", "follow_up_2");
    else if (filter === "Follow Up 3") params.set("followUp", "follow_up_3");
    else if (filter === "Cold") params.set("followUp", "cold");
    else if (filter === "Project Only") params.set("followUp", "project_only");
    params.set("sortBy", sortBy);
    return params;
  }, [search, filter, sortBy]);

  const fetchData = useCallback(() => {
    setLoading(true);
    // Reset selection when filter changes
    setSelectedIds(new Set());
    setSelectAllDB(false);

    fetch(`/api/users?${buildFilterParams()}`)
      .then((res) => res.json())
      .then((json) => { setUsers(json.users || []); setTotal(json.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [buildFilterParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Selection helpers ───────────────────────────────────────
  const allVisibleSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      setSelectAllDB(false);
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
      setSelectAllDB(false);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllDB(false);
  };

  // ─── Export ke Follow-Up ──────────────────────────────────────
  const exportToFollowUp = () => {
    const params = new URLSearchParams();
    params.set("export", "1");

    if (selectAllDB) {
      // Kirim filter params saja, biarkan followup page yang fetch
      params.set("allUsers", "1");
      const filterParams = buildFilterParams();
      filterParams.forEach((v, k) => { if (k !== "sortBy") params.set(k, v); });
    } else {
      // Kirim list ID
      params.set("users", Array.from(selectedIds).join(","));
    }

    router.push(`/followup?${params}`);
  };

  // ─── Follow-up action ─────────────────────────────────────────
  async function handleFollowUp(user: UserItem) {
    const followUp = user.followUpStatus || "none";
    const template = followUpTemplates[followUp] || followUpTemplates.follow_up_1;
    const message = template.replace("{name}", user.name);
    const nextStatus = getNextFollowUp(followUp);

    const waUrl = `https://wa.me/${user.whatsapp?.replace(/^0/, "62")}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");

    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpStatus: nextStatus }),
    });

    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        whatsappNumber: user.whatsapp,
        messageType: followUp === "none" ? "follow_up_1" : followUp,
        messageContent: message,
        status: "sent",
      }),
    });

    fetchData();
  }

  async function openUserTransactions(user: UserItem) {
    setSelectedUser(user);
    setShowModal(true);
    setLoadingTransactions(true);
    setUserTransactions([]);
    try {
      const res = await fetch(`/api/users/${user.id}/transactions`);
      const json = await res.json();
      if (json.success) setUserTransactions(json.transactions);
    } catch (e) {
      console.error("Gagal get transactions:", e);
    }
    setLoadingTransactions(false);
  }

  function getTypeBadge(type: string | null) {
    switch (type) {
      case "returning": return <span className="badge badge-info">Returning</span>;
      case "loyal": return <span className="badge badge-purple">Loyal</span>;
      default: return <span className="badge badge-neutral">New</span>;
    }
  }

  function getStatusBadge(status: string | null) {
    return status === "active"
      ? <span className="badge badge-success">Aktif</span>
      : <span className="badge badge-danger">Tidak Aktif</span>;
  }

  function getFollowUpBadge(status: string | null) {
    switch (status) {
      case "none": case null: return <span className="text-sm text-[var(--text-muted)]">Tidak Perlu</span>;
      case "follow_up_1": return <span className="badge badge-warning">Follow Up 1</span>;
      case "follow_up_2": return <span className="badge badge-warning">Follow Up 2</span>;
      case "follow_up_3": return <span className="badge badge-danger">Follow Up 3</span>;
      case "cold": return <span className="badge badge-neutral">Cold</span>;
      case "project_only": return <span className="badge badge-purple">Project Only</span>;
      default: return <span className="badge badge-neutral">{status}</span>;
    }
  }

  const needsFollowUp = (user: UserItem) =>
    user.subscriptionStatus !== "active" && user.followUpStatus !== "none" && user.followUpStatus !== null;

  const selectionCount = selectAllDB ? total : selectedIds.size;

  return (
    <>
      <Topbar title="Pelanggan" subtitle="Kelola data pelanggan dan sistem retensi follow-up" />

      <div className="px-8 pb-8 space-y-5">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="search-box flex-1 w-full md:max-w-md">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Cari nama, email, atau nomor WA..." className="form-input !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 h-[38px]">
            <select className="bg-transparent text-sm text-[var(--text-secondary)] outline-none w-full" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="terbaru">Terbaru (Default)</option>
              <option value="terlama">Terlama</option>
              <option value="total_trx_desc">Transaksi Terbanyak</option>
              <option value="total_trx_asc">Transaksi Tersedikit</option>
              <option value="last_trx_desc">Pembelian Terakhir (Terbaru)</option>
              <option value="last_trx_asc">Pembelian Terakhir (Terlama)</option>
            </select>
          </div>
          <div className="filter-pills flex-wrap">
            {filterOptions.map((f) => (
              <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#818cf8]" /><span className="ml-2 text-[var(--text-secondary)]">Memuat...</span></div>
          ) : (
            <>
              {/* ── Banner pilih semua DB ── */}
              {allVisibleSelected && total > users.length && !selectAllDB && (
                <div className="flex items-center justify-center gap-3 py-3 px-6" style={{ background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {users.length} user di halaman ini dipilih.
                  </span>
                  <button
                    onClick={() => setSelectAllDB(true)}
                    className="text-sm font-semibold text-[#818cf8] hover:text-[#a5b4fc] transition-colors underline underline-offset-2"
                  >
                    Pilih semua {total} user dari hasil filter ini
                  </button>
                </div>
              )}
              {selectAllDB && (
                <div className="flex items-center justify-center gap-3 py-3 px-6" style={{ background: "rgba(99,102,241,0.12)", borderBottom: "1px solid rgba(99,102,241,0.2)" }}>
                  <span className="text-sm font-medium text-[#818cf8]">
                    ✓ Semua {total} user dari filter ini dipilih.
                  </span>
                  <button onClick={() => { setSelectAllDB(false); setSelectedIds(new Set()); }}
                    className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">
                    Batalkan
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44, paddingLeft: 20 }}>
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center justify-center text-[var(--text-muted)] hover:text-[#818cf8] transition-colors"
                          title={allVisibleSelected ? "Batalkan semua" : "Pilih semua yang tampil"}
                        >
                          {allVisibleSelected
                            ? <CheckSquare size={16} className="text-[#818cf8]" />
                            : <Square size={16} />
                          }
                        </button>
                      </th>
                      <th>Pelanggan</th>
                      <th>WhatsApp</th>
                      <th>Tipe</th>
                      <th>Status</th>
                      <th>Follow Up</th>
                      <th>Total TRX</th>
                      <th>Pembelian Terakhir</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-8 text-[var(--text-muted)]">Belum ada pelanggan</td></tr>
                    ) : (
                      users.map((user) => {
                        const isSelected = selectAllDB || selectedIds.has(user.id);
                        return (
                          <tr
                            key={user.id}
                            style={isSelected ? { background: "rgba(99,102,241,0.07)" } : undefined}
                          >
                            <td style={{ paddingLeft: 20, paddingRight: 8 }}>
                              <button
                                onClick={() => { if (!selectAllDB) toggleOne(user.id); }}
                                className={`flex items-center justify-center transition-colors ${selectAllDB ? "opacity-50 cursor-not-allowed" : "hover:text-[#818cf8]"} text-[var(--text-muted)]`}
                              >
                                {isSelected
                                  ? <CheckSquare size={16} className="text-[#818cf8]" />
                                  : <Square size={16} />
                                }
                              </button>
                            </td>
                            <td>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{maskEmail(user.email)}</p>
                            </td>
                            <td className="text-sm">{maskPhone(user.whatsapp)}</td>
                            <td>{getTypeBadge(user.customerType)}</td>
                            <td>{getStatusBadge(user.subscriptionStatus)}</td>
                            <td>{getFollowUpBadge(user.followUpStatus)}</td>
                            <td className="text-center font-semibold">{user._count.transactions}</td>
                            <td className="text-sm text-[var(--text-secondary)]">
                              {user.transactions[0] ? formatDate(user.transactions[0].purchaseDate) : "-"}
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                <button className="btn-icon" style={{ width: 32, height: 32 }} title="Lihat Detail Transaksi" onClick={() => openUserTransactions(user)}><Eye size={15} /></button>
                                <button className="btn-icon" style={{ width: 32, height: 32 }} title="Edit"><Edit2 size={15} /></button>
                                {(needsFollowUp(user) || user.subscriptionStatus !== "active") && user.whatsapp && (
                                  <button className="btn-success btn-sm" onClick={() => handleFollowUp(user)} title="Follow Up WhatsApp">
                                    <MessageCircle size={14} /> WA
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(99,102,241,0.08)]">
                <p className="text-sm text-[var(--text-muted)]">Total {total} pelanggan</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Floating Action Bar ── */}
      <div
        style={{
          position: "fixed",
          bottom: someSelected ? 32 : -100,
          left: "50%",
          transform: "translateX(-50%)",
          transition: "bottom 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          background: "rgba(15,17,30,0.92)",
          backdropFilter: "blur(16px)",
          borderRadius: 16,
          border: "1px solid rgba(99,102,241,0.35)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)",
          whiteSpace: "nowrap",
        }}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Users size={15} className="text-[#818cf8]" />
          <span className="text-[#818cf8] font-bold">{selectionCount}</span>
          <span className="text-[var(--text-secondary)]">user dipilih</span>
        </span>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />

        <button
          onClick={exportToFollowUp}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            borderRadius: 10,
            border: "none",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Send size={14} />
          Export ke Follow-Up
        </button>

        <button
          onClick={clearSelection}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--text-muted)",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          title="Batalkan pilihan"
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
        >
          <X size={14} />
        </button>
      </div>

      {/* Modal Histori Transaksi */}
      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2"><Receipt size={18} className="text-[#818cf8]" /> Histori Transaksi: {selectedUser.name}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[#818cf8]" /></div>
              ) : userTransactions.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">Belum ada transaksi direkam.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Nominal</th>
                        <th>Akun (Email)</th>
                        <th>Produk</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userTransactions.map(trx => (
                        <tr key={trx.id}>
                          <td className="text-[var(--text-secondary)]">{formatDate(trx.purchaseDate)}</td>
                          <td className="font-semibold">{formatCurrency(trx.amount)}</td>
                          <td className="font-mono text-xs text-[var(--text-secondary)]">{trx.stockAccount?.accountEmail || "-"}</td>
                          <td className="capitalize">{trx.stockAccount?.productType || "-"}</td>
                          <td>
                            {trx.status === "success" ? <span className="badge badge-success !text-[10px] !py-0.5">Sukses</span> : <span className="badge badge-danger !text-[10px] !py-0.5">Gagal</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
