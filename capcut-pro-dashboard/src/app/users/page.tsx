"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Search,
  MessageCircle,
  Eye,
  Loader2,
  X,
  Receipt,
  CheckSquare,
  Square,
  Send,
  Users,
  Tag,
  Plus,
  Trash2,
  TagIcon,
  Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TagItem {
  id: string;
  name: string;
  color: string;
  _count?: { customers: number };
}

interface CustomerTagItem {
  tag: TagItem;
}

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
  tags: CustomerTagItem[];
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#818cf8", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#ef4444", "#f97316", "#f59e0b",
  "#eab308", "#84cc16", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6b7280",
];

const BASE_FILTERS = ["Semua", "Aktif", "Tidak Aktif"];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID");
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UsersPage() {
  const { maskEmail, maskPhone } = usePrivacy();
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [sortBy, setSortBy] = useState("terbaru");

  // Tag state
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#818cf8");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagError, setTagError] = useState("");
  const [deleteTagConfirm, setDeleteTagConfirm] = useState<TagItem | null>(null);
  const [deletingTag, setDeletingTag] = useState(false);

  // Popover assign tag
  const [tagPopoverUserId, setTagPopoverUserId] = useState<string | null>(null);
  const [togglingTag, setTogglingTag] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllDB, setSelectAllDB] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [userTransactions, setUserTransactions] = useState<TransactionHistory[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  // ─── Fetch Tags ──────────────────────────────────────────────────────────────

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const json = await res.json();
      setAllTags(json.tags || []);
    } catch (e) {
      console.error("Gagal fetch tags:", e);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  // ─── Fetch Users ─────────────────────────────────────────────────────────────

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filter === "Aktif") params.set("status", "active");
    else if (filter === "Tidak Aktif") params.set("status", "inactive");
    if (activeTagId) params.set("tagId", activeTagId);
    params.set("sortBy", sortBy);
    return params;
  }, [search, filter, sortBy, activeTagId]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setSelectedIds(new Set());
    setSelectAllDB(false);

    fetch(`/api/users?${buildFilterParams()}`)
      .then((res) => res.json())
      .then((json) => { setUsers(json.users || []); setTotal(json.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [buildFilterParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setTagPopoverUserId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Tag Manager ─────────────────────────────────────────────────────────────

  async function handleCreateTag() {
    if (!newTagName.trim()) { setTagError("Nama tag tidak boleh kosong"); return; }
    setCreatingTag(true);
    setTagError("");
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      const json = await res.json();
      if (!res.ok) { setTagError(json.error || "Gagal membuat tag"); return; }
      setNewTagName("");
      setNewTagColor("#818cf8");
      fetchTags();
    } finally {
      setCreatingTag(false);
    }
  }

  async function handleDeleteTag() {
    if (!deleteTagConfirm) return;
    setDeletingTag(true);
    try {
      await fetch(`/api/tags/${deleteTagConfirm.id}`, { method: "DELETE" });
      if (activeTagId === deleteTagConfirm.id) setActiveTagId(null);
      setDeleteTagConfirm(null);
      fetchTags();
      fetchData();
    } finally {
      setDeletingTag(false);
    }
  }

  // ─── Assign / Remove Tag pada Pelanggan ──────────────────────────────────────

  async function toggleTagOnUser(userId: string, tagId: string, hasTag: boolean) {
    setTogglingTag(tagId);
    try {
      if (hasTag) {
        await fetch(`/api/users/${userId}/tags`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
      } else {
        await fetch(`/api/users/${userId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
      }
      fetchData();
    } finally {
      setTogglingTag(null);
    }
  }

  // ─── Selection ───────────────────────────────────────────────────────────────

  const allVisibleSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allVisibleSelected) { setSelectedIds(new Set()); setSelectAllDB(false); }
    else setSelectedIds(new Set(users.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) { next.delete(id); setSelectAllDB(false); } else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => { setSelectedIds(new Set()); setSelectAllDB(false); };

  // ─── Export ke Follow-Up ─────────────────────────────────────────────────────

  const exportToFollowUp = () => {
    const params = new URLSearchParams();
    params.set("export", "1");
    if (selectAllDB) {
      params.set("allUsers", "1");
      const filterParams = buildFilterParams();
      filterParams.forEach((v, k) => { if (k !== "sortBy") params.set(k, v); });
    } else {
      params.set("users", Array.from(selectedIds).join(","));
    }
    router.push(`/followup?${params}`);
  };

  // ─── Transactions Modal ───────────────────────────────────────────────────────

  async function openUserTransactions(user: UserItem) {
    setSelectedUser(user);
    setShowModal(true);
    setLoadingTransactions(true);
    setUserTransactions([]);
    try {
      const res = await fetch(`/api/users/${user.id}/transactions`);
      const json = await res.json();
      if (json.success) setUserTransactions(json.transactions);
    } catch (e) { console.error("Gagal get transactions:", e); }
    setLoadingTransactions(false);
  }

  // ─── Badge helpers ────────────────────────────────────────────────────────────

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

  const selectionCount = selectAllDB ? total : selectedIds.size;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Topbar title="Pelanggan" subtitle="Kelola data pelanggan dan sistem retensi follow-up" />

      <div className="px-8 pb-8 space-y-5">
        {/* ── Toolbar ── */}
        <div className="flex flex-col md:flex-row items-start gap-3">
          <div className="search-box flex-1 w-full md:max-w-md">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Cari nama, email, atau nomor WA..."
              className="form-input !pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 h-[38px]">
            <select
              className="bg-transparent text-sm text-[var(--text-secondary)] outline-none w-full"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="terbaru">Terbaru (Default)</option>
              <option value="terlama">Terlama</option>
              <option value="total_trx_desc">Transaksi Terbanyak</option>
              <option value="total_trx_asc">Transaksi Tersedikit</option>
              <option value="last_trx_desc">Pembelian Terakhir (Terbaru)</option>
              <option value="last_trx_asc">Pembelian Terakhir (Terlama)</option>
            </select>
          </div>
          {/* Tag Manager Button */}
          <button
            onClick={() => setShowTagManager(true)}
            className="flex items-center gap-2 px-3 py-1.5 h-[38px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-sm text-[var(--text-secondary)] hover:text-white hover:border-[#818cf8] transition-all"
          >
            <TagIcon size={15} />
            Kelola Tag
          </button>
        </div>

        {/* ── Filter Pills: Base + Custom Tags ── */}
        <div className="filter-pills flex-wrap gap-y-2">
          {BASE_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-pill ${filter === f && !activeTagId ? "active" : ""}`}
              onClick={() => { setFilter(f); setActiveTagId(null); }}
            >
              {f}
            </button>
          ))}
          {allTags.length > 0 && (
            <div className="w-px h-5 bg-[var(--border-color)] self-center mx-1" />
          )}
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => {
                if (activeTagId === tag.id) { setActiveTagId(null); setFilter("Semua"); }
                else { setActiveTagId(tag.id); setFilter("Semua"); }
              }}
              style={{
                borderColor: activeTagId === tag.id ? tag.color : undefined,
                background: activeTagId === tag.id ? `${tag.color}22` : undefined,
                color: activeTagId === tag.id ? tag.color : undefined,
              }}
              className={`filter-pill flex items-center gap-1.5 ${activeTagId === tag.id ? "" : ""}`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: tag.color }}
              />
              {tag.name}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[#818cf8]" />
              <span className="ml-2 text-[var(--text-secondary)]">Memuat...</span>
            </div>
          ) : (
            <>
              {/* Banner pilih semua DB */}
              {allVisibleSelected && total > users.length && !selectAllDB && (
                <div className="flex items-center justify-center gap-3 py-3 px-6" style={{ background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.15)" }}>
                  <span className="text-sm text-[var(--text-secondary)]">{users.length} user di halaman ini dipilih.</span>
                  <button onClick={() => setSelectAllDB(true)} className="text-sm font-semibold text-[#818cf8] hover:text-[#a5b4fc] transition-colors underline underline-offset-2">
                    Pilih semua {total} user dari hasil filter ini
                  </button>
                </div>
              )}
              {selectAllDB && (
                <div className="flex items-center justify-center gap-3 py-3 px-6" style={{ background: "rgba(99,102,241,0.12)", borderBottom: "1px solid rgba(99,102,241,0.2)" }}>
                  <span className="text-sm font-medium text-[#818cf8]">✓ Semua {total} user dari filter ini dipilih.</span>
                  <button onClick={() => { setSelectAllDB(false); setSelectedIds(new Set()); }} className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Batalkan</button>
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
                          {allVisibleSelected ? <CheckSquare size={16} className="text-[#818cf8]" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th>Pelanggan</th>
                      <th>WhatsApp</th>
                      <th>Tipe</th>
                      <th>Status</th>
                      <th>Tag</th>
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
                        const userTagIds = new Set(user.tags?.map((t) => t.tag.id) || []);
                        const isPopoverOpen = tagPopoverUserId === user.id;

                        return (
                          <tr key={user.id} style={isSelected ? { background: "rgba(99,102,241,0.07)" } : undefined}>
                            {/* Checkbox */}
                            <td style={{ paddingLeft: 20, paddingRight: 8 }}>
                              <button
                                onClick={() => { if (!selectAllDB) toggleOne(user.id); }}
                                className={`flex items-center justify-center transition-colors ${selectAllDB ? "opacity-50 cursor-not-allowed" : "hover:text-[#818cf8]"} text-[var(--text-muted)]`}
                              >
                                {isSelected ? <CheckSquare size={16} className="text-[#818cf8]" /> : <Square size={16} />}
                              </button>
                            </td>

                            {/* Nama & Email */}
                            <td>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{maskEmail(user.email)}</p>
                            </td>

                            {/* WhatsApp */}
                            <td className="text-sm">{maskPhone(user.whatsapp)}</td>

                            {/* Tipe */}
                            <td>{getTypeBadge(user.customerType)}</td>

                            {/* Status */}
                            <td>{getStatusBadge(user.subscriptionStatus)}</td>

                            {/* Tag Column — display only, badge berwarna */}
                            <td>
                              <div className="flex items-center gap-1 flex-wrap" style={{ minWidth: 100 }}>
                                {!user.tags || user.tags.length === 0 ? (
                                  <span className="text-xs text-[var(--text-muted)]">—</span>
                                ) : (
                                  user.tags.slice(0, 3).map((ct) => (
                                    <span
                                      key={ct.tag.id}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                                      style={{
                                        background: `${ct.tag.color}22`,
                                        color: ct.tag.color,
                                        border: `1px solid ${ct.tag.color}44`,
                                      }}
                                    >
                                      {ct.tag.name}
                                    </span>
                                  ))
                                )}
                                {(user.tags?.length || 0) > 3 && (
                                  <span className="text-[11px] text-[var(--text-muted)]">+{(user.tags.length - 3)}</span>
                                )}
                              </div>
                            </td>

                            {/* Total TRX */}
                            <td className="text-center font-semibold">{user._count.transactions}</td>

                            {/* Pembelian Terakhir */}
                            <td className="text-sm text-[var(--text-secondary)]">
                              {user.transactions[0] ? formatDate(user.transactions[0].purchaseDate) : "-"}
                            </td>

                            {/* Aksi */}
                            <td>
                              <div className="flex items-center gap-1">
                                <button className="btn-icon" style={{ width: 32, height: 32 }} title="Lihat Detail Transaksi" onClick={() => openUserTransactions(user)}>
                                  <Eye size={15} />
                                </button>
                                {user.whatsapp && (
                                  <a
                                    href={`https://wa.me/${user.whatsapp.replace(/^0/, "62").replace(/\D/g, "")}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="btn-icon"
                                    style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "#25d366" }}
                                    title="Chat WhatsApp"
                                  >
                                    <MessageCircle size={15} />
                                  </a>
                                )}

                                {/* Tombol assign tag — jelas & berlabel */}
                                <div className="relative" ref={isPopoverOpen ? popoverRef : null}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTagPopoverUserId(isPopoverOpen ? null : user.id);
                                    }}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all"
                                    style={{
                                      height: 28,
                                      background: isPopoverOpen ? "rgba(129,140,248,0.2)" : "rgba(129,140,248,0.08)",
                                      border: "1px solid rgba(129,140,248,0.3)",
                                      color: "#818cf8",
                                    }}
                                    title="Kelola tag pelanggan ini"
                                  >
                                    <Tag size={12} />
                                    Tag
                                  </button>

                                  {/* Tag Popover */}
                                  {isPopoverOpen && (
                                    <div
                                      className="absolute z-50 right-0 top-8 w-52 rounded-xl border border-[var(--border-color)] shadow-2xl overflow-hidden"
                                      style={{ background: "rgba(15,17,30,0.97)", backdropFilter: "blur(16px)" }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="px-3 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2">
                                        <Tag size={13} className="text-[#818cf8]" />
                                        <p className="text-xs font-semibold text-white">Tag untuk {user.name.split(" ")[0]}</p>
                                      </div>
                                      {allTags.length === 0 ? (
                                        <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
                                          Belum ada tag.<br />
                                          <button
                                            onClick={() => { setShowTagManager(true); setTagPopoverUserId(null); }}
                                            className="text-[#818cf8] underline mt-1.5 font-medium"
                                          >
                                            Buat tag dulu →
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="py-1 max-h-52 overflow-y-auto">
                                          {allTags.map((tag) => {
                                            const has = userTagIds.has(tag.id);
                                            const isToggling = togglingTag === tag.id;
                                            return (
                                              <button
                                                key={tag.id}
                                                onClick={() => toggleTagOnUser(user.id, tag.id, has)}
                                                disabled={isToggling}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-white/5 transition-colors text-left"
                                              >
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                                                <span className="flex-1 text-[var(--text-secondary)]">{tag.name}</span>
                                                {isToggling
                                                  ? <Loader2 size={13} className="animate-spin text-[var(--text-muted)]" />
                                                  : has
                                                    ? <span className="flex items-center gap-1 text-[11px] font-semibold text-[#22c55e]"><Check size={11} /> Aktif</span>
                                                    : <span className="text-[11px] text-[var(--text-muted)]">Tambah</span>
                                                }
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                      <div className="px-3 py-2 border-t border-[var(--border-color)]">
                                        <button
                                          onClick={() => { setShowTagManager(true); setTagPopoverUserId(null); }}
                                          className="w-full text-xs text-[var(--text-muted)] hover:text-[#818cf8] transition-colors text-center"
                                        >
                                          + Buat tag baru
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
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
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px",
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            borderRadius: 10, border: "none", color: "white",
            fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "opacity 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Send size={14} /> Export ke Follow-Up
        </button>
        <button
          onClick={clearSelection}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--text-muted)", cursor: "pointer", transition: "background 0.2s",
          }}
          title="Batalkan pilihan"
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
        >
          <X size={14} />
        </button>
      </div>

      {/* ════════════════════════════════════════════
          Tag Manager Modal
      ════════════════════════════════════════════ */}
      {showTagManager && (
        <div className="modal-overlay" onClick={() => setShowTagManager(false)}>
          <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                <Tag size={18} className="text-[#818cf8]" /> Kelola Tag Pelanggan
              </h3>
              <button className="btn-icon" onClick={() => setShowTagManager(false)}><X size={18} /></button>
            </div>

            <div className="modal-body space-y-5">
              {/* ── Buat Tag Baru ── */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Buat Tag Baru</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nama tag..."
                    className="form-input flex-1"
                    value={newTagName}
                    onChange={(e) => { setNewTagName(e.target.value); setTagError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); }}
                    maxLength={50}
                  />
                  <div className="relative flex-shrink-0">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-10 h-10 rounded-xl border border-[var(--border-color)] cursor-pointer bg-transparent p-0.5"
                      title="Pilih warna"
                    />
                  </div>
                  <button
                    onClick={handleCreateTag}
                    disabled={creatingTag || !newTagName.trim()}
                    className="btn-primary flex items-center gap-2 px-4"
                    style={{ height: 40, borderRadius: 12 }}
                  >
                    {creatingTag ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Buat
                  </button>
                </div>

                {/* Preset Colors */}
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        background: c,
                        borderColor: newTagColor === c ? "white" : "transparent",
                        boxShadow: newTagColor === c ? `0 0 0 1px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>

                {/* Preview */}
                {newTagName.trim() && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">Preview:</span>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: `${newTagColor}22`,
                        color: newTagColor,
                        border: `1px solid ${newTagColor}44`,
                      }}
                    >
                      {newTagName}
                    </span>
                  </div>
                )}

                {tagError && <p className="text-xs text-red-400">{tagError}</p>}
              </div>

              {/* ── Daftar Tag yang Ada ── */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Tag yang Ada ({allTags.length})
                </p>
                {allTags.length === 0 ? (
                  <div className="text-center py-6 text-sm text-[var(--text-muted)]">
                    Belum ada tag. Buat tag baru di atas!
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {allTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border-color)] hover:border-[rgba(99,102,241,0.3)] transition-colors"
                        style={{ background: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                          <span className="text-sm font-medium text-white">{tag.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{tag._count?.customers || 0} pelanggan</span>
                        </div>
                        <button
                          onClick={() => setDeleteTagConfirm(tag)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all"
                          title="Hapus tag"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTagManager(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          Delete Tag Konfirmasi Popup
      ════════════════════════════════════════════ */}
      {deleteTagConfirm && (
        <div className="modal-overlay" style={{ zIndex: 60 }} onClick={() => { if (!deletingTag) setDeleteTagConfirm(null); }}>
          <div
            className="modal-content"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Trash2 size={18} className="text-red-400" /> Hapus Tag
              </h3>
              <button className="btn-icon" onClick={() => setDeleteTagConfirm(null)} disabled={deletingTag}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div
                className="rounded-xl p-4 border border-red-500/20 mb-4"
                style={{ background: "rgba(239,68,68,0.06)" }}
              >
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Yakin ingin menghapus tag{" "}
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mx-1"
                    style={{
                      background: `${deleteTagConfirm.color}22`,
                      color: deleteTagConfirm.color,
                      border: `1px solid ${deleteTagConfirm.color}44`,
                    }}
                  >
                    {deleteTagConfirm.name}
                  </span>
                  ?
                </p>
                <p className="text-sm text-red-400 mt-2 font-medium">
                  ⚠️ Tag ini akan dihapus dari{" "}
                  <strong>{deleteTagConfirm._count?.customers || 0} pelanggan</strong> dan tidak bisa dikembalikan.
                </p>
              </div>
            </div>
            <div className="modal-footer gap-3">
              <button
                className="btn-secondary"
                onClick={() => setDeleteTagConfirm(null)}
                disabled={deletingTag}
              >
                Batal
              </button>
              <button
                onClick={handleDeleteTag}
                disabled={deletingTag}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity"
                style={{
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  border: "none",
                  cursor: deletingTag ? "wait" : "pointer",
                  opacity: deletingTag ? 0.7 : 1,
                }}
              >
                {deletingTag ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Ya, Hapus Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          Modal Histori Transaksi
      ════════════════════════════════════════════ */}
      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                <Receipt size={18} className="text-[#818cf8]" /> Histori Transaksi: {selectedUser.name}
              </h3>
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
                            {trx.status === "success"
                              ? <span className="badge badge-success !text-[10px] !py-0.5">Sukses</span>
                              : <span className="badge badge-danger !text-[10px] !py-0.5">Gagal</span>}
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
