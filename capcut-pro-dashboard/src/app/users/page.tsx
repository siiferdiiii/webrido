"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  LayoutList,
  LayoutGrid,
  SlidersHorizontal,
  ChevronDown,
  CalendarDays,
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

interface ActiveFilters {
  status: 'all' | 'active' | 'inactive';
  tagIds: string[];
  lastTrxFrom: string;
  lastTrxTo: string;
  minTrx: string;
  maxTrx: string;
}

const EMPTY_FILTERS: ActiveFilters = {
  status: 'all', tagIds: [], lastTrxFrom: '', lastTrxTo: '', minTrx: '', maxTrx: '',
};

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
  const [sortBy, setSortBy] = useState("terbaru");

  // Advanced filter state
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [draftFilters, setDraftFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filterBtnRect, setFilterBtnRect] = useState<DOMRect | null>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Tag state
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#818cf8");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagError, setTagError] = useState("");
  const [deleteTagConfirm, setDeleteTagConfirm] = useState<TagItem | null>(null);
  const [deletingTag, setDeletingTag] = useState(false);

  // Popover assign tag
  const [tagPopoverUserId, setTagPopoverUserId] = useState<string | null>(null);
  const [tagPopoverPos, setTagPopoverPos] = useState<{ top: number; right: number } | null>(null);
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
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

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

  // isMobile detector
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (activeFilters.status === "active") params.set("status", "active");
    else if (activeFilters.status === "inactive") params.set("status", "inactive");
    if (activeFilters.tagIds.length > 0) params.set("tagIds", activeFilters.tagIds.join(","));
    if (activeFilters.lastTrxFrom) params.set("lastTrxFrom", activeFilters.lastTrxFrom);
    if (activeFilters.lastTrxTo) params.set("lastTrxTo", activeFilters.lastTrxTo);
    if (activeFilters.minTrx) params.set("minTrx", activeFilters.minTrx);
    if (activeFilters.maxTrx) params.set("maxTrx", activeFilters.maxTrx);
    params.set("sortBy", sortBy);
    return params;
  }, [search, activeFilters, sortBy]);

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

  // Close popover on outside click or scroll
  useEffect(() => {
    if (!tagPopoverUserId) return;
    const close = () => { setTagPopoverUserId(null); setTagPopoverPos(null); };
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", close, true);
    };
  }, [tagPopoverUserId]);

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
      // If any active filter uses this tag, remove it
      setActiveFilters(f => ({ ...f, tagIds: f.tagIds.filter(id => id !== deleteTagConfirm.id) }));
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

  // Count of active (non-default) filter categories
  const activeFilterCount = [
    activeFilters.status !== 'all',
    activeFilters.tagIds.length > 0,
    !!(activeFilters.lastTrxFrom || activeFilters.lastTrxTo),
    !!(activeFilters.minTrx || activeFilters.maxTrx),
  ].filter(Boolean).length;

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

  /** True jika user punya transaksi dalam 60 hari terakhir */
  function isUserActive(user: UserItem): boolean {
    const lastDate = user.transactions[0]?.purchaseDate;
    if (!lastDate) return false;
    const diff = Date.now() - new Date(lastDate).getTime();
    return diff <= 60 * 24 * 60 * 60 * 1000;
  }

  function getStatusBadge(user: UserItem) {
    return isUserActive(user)
      ? <span className="badge badge-success">Aktif</span>
      : <span className="badge badge-danger">Tidak Aktif</span>;
  }

  const selectionCount = selectAllDB ? total : selectedIds.size;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Topbar title="Pelanggan" subtitle="Kelola data pelanggan dan sistem retensi follow-up" />

      <div className="px-4 md:px-8 pb-8 space-y-5">
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

        {/* ── Filter Button + Active Chips ── */}
        <div className="flex flex-col gap-3">
          <div className="filter-pills-scroll">
            <div className="flex items-center gap-2 flex-nowrap">

              {/* ── Filter Button ── */}
              <div className="relative filter-panel-wrapper flex-shrink-0">
                <button
                  ref={filterBtnRef}
                  onClick={() => {
                    if (!showFilterPanel) {
                      setDraftFilters({ ...activeFilters });
                      setFilterBtnRect(filterBtnRef.current?.getBoundingClientRect() || null);
                    }
                    setShowFilterPanel(p => !p);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', height: 38, borderRadius: 10,
                    border: `1px solid ${activeFilterCount > 0 ? 'rgba(99,102,241,0.5)' : 'var(--border-color)'}`,
                    background: activeFilterCount > 0 ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                    color: activeFilterCount > 0 ? '#818cf8' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  <SlidersHorizontal size={14} />
                  Filter
                  {activeFilterCount > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: 9, padding: '0 4px',
                      background: '#6366f1', color: 'white', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{activeFilterCount}</span>
                  )}
                  <ChevronDown size={12} style={{ transform: showFilterPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>

              {/* Quick status pills */}
              {(['all', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveFilters(f => ({ ...f, status: s }))}
                  className={`filter-pill flex-shrink-0 ${activeFilters.status === s ? 'active' : ''}`}
                >
                  {s === 'all' ? 'Semua' : s === 'active' ? 'Aktif' : 'Tidak Aktif'}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {(activeFilters.lastTrxFrom || activeFilters.lastTrxTo) && (
                <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:8, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', fontSize:11, color:'#a5b4fc' }}>
                  <CalendarDays size={11} />
                  {activeFilters.lastTrxFrom || '...'} → {activeFilters.lastTrxTo || '...'}
                  <button onClick={() => setActiveFilters(f => ({ ...f, lastTrxFrom:'', lastTrxTo:'' }))} style={{marginLeft:2,cursor:'pointer',color:'inherit',opacity:0.7}}><X size={10}/></button>
                </span>
              )}
              {(activeFilters.minTrx || activeFilters.maxTrx) && (
                <span style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:8, background:'rgba(34,211,238,0.08)', border:'1px solid rgba(34,211,238,0.2)', fontSize:11, color:'#67e8f9' }}>
                  TRX {activeFilters.minTrx || '0'} – {activeFilters.maxTrx || '∞'}
                  <button onClick={() => setActiveFilters(f => ({ ...f, minTrx:'', maxTrx:'' }))} style={{marginLeft:2,cursor:'pointer',color:'inherit',opacity:0.7}}><X size={10}/></button>
                </span>
              )}
              {activeFilters.tagIds.map(tid => {
                const tag = allTags.find(t => t.id === tid);
                if (!tag) return null;
                return (
                  <span key={tid} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:8, background:`${tag.color}15`, border:`1px solid ${tag.color}33`, fontSize:11, color:tag.color }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:tag.color }} />
                    {tag.name}
                    <button onClick={() => setActiveFilters(f => ({ ...f, tagIds: f.tagIds.filter(id=>id!==tid) }))} style={{marginLeft:2,cursor:'pointer',color:'inherit',opacity:0.7}}><X size={10}/></button>
                  </span>
                );
              })}
              <button
                onClick={() => setActiveFilters({ ...EMPTY_FILTERS })}
                style={{ padding:'3px 8px', borderRadius:6, fontSize:11, color:'var(--text-muted)', border:'1px solid rgba(255,255,255,0.08)', background:'transparent', cursor:'pointer' }}
              >
                Hapus semua
              </button>
            </div>
          )}
        </div>

        {/* View Toggle mobile */}
        <div className="flex items-center justify-between lg:hidden">
          <p className="text-xs text-[var(--text-muted)]">Total {total} pelanggan</p>
          <div className="flex gap-1">
            <button className={`view-toggle-btn ${viewMode==='table'?'active':''}`} onClick={()=>setViewMode('table')}><LayoutList size={13}/> Tabel</button>
            <button className={`view-toggle-btn ${viewMode==='card'?'active':''}`} onClick={()=>setViewMode('card')}><LayoutGrid size={13}/> Card</button>
          </div>
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

              {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 44, paddingLeft: 20 }}>
                        <button onClick={toggleSelectAll} className="flex items-center justify-center text-[var(--text-muted)] hover:text-[#818cf8] transition-colors" title={allVisibleSelected ? "Batalkan semua" : "Pilih semua yang tampil"}>
                          {allVisibleSelected ? <CheckSquare size={16} className="text-[#818cf8]" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th>Pelanggan</th>
                      <th>WhatsApp</th>
                      <th>Tipe</th>
                      <th>Tag</th>
                      <th>Total TRX</th>
                      <th>Pembelian Terakhir</th>
                      <th>Status</th>
                      <th className="sticky-col-head">Aksi</th>
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

                            {/* Status */}
                            <td>{getStatusBadge(user)}</td>

                            {/* Aksi */}
                            <td className="sticky-col-body">
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

                                {/* Tombol assign tag */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPopoverOpen) {
                                      setTagPopoverUserId(null);
                                      setTagPopoverPos(null);
                                    } else {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setTagPopoverPos({
                                        top: rect.bottom + 8,
                                        right: window.innerWidth - rect.right,
                                      });
                                      setTagPopoverUserId(user.id);
                                    }
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
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              )}

              {/* ── Card View (mobile) ── */}
              {viewMode === 'card' && (
                <div className="data-card-grid">
                  {users.length === 0 ? (
                    <p className="text-center py-8 text-[var(--text-muted)]">Belum ada pelanggan</p>
                  ) : users.map((user) => {
                    const isSelected = selectAllDB || selectedIds.has(user.id);
                    return (
                      <div key={user.id} className="data-card" style={isSelected ? { borderColor: 'rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.06)' } : undefined}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                            <button onClick={() => { if (!selectAllDB) toggleOne(user.id); }} className={`flex-shrink-0 text-[var(--text-muted)] ${selectAllDB ? 'opacity-50 cursor-not-allowed' : 'hover:text-[#818cf8]'}`}>
                              {isSelected ? <CheckSquare size={15} className="text-[#818cf8]" /> : <Square size={15} />}
                            </button>
                            <div className="min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{user.name}</p>
                              <p className="text-xs text-[var(--text-muted)] truncate">{maskEmail(user.email)}</p>
                            </div>
                          </div>
                          {isUserActive(user) ? <span className="badge badge-success">Aktif</span> : <span className="badge badge-danger">Tidak Aktif</span>}
                        </div>
                        {user.tags && user.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {user.tags.slice(0, 3).map(ct => (
                              <span key={ct.tag.id} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${ct.tag.color}22`, color: ct.tag.color, border: `1px solid ${ct.tag.color}44` }}>{ct.tag.name}</span>
                            ))}
                            {user.tags.length > 3 && <span className="text-[10px] text-[var(--text-muted)]">+{user.tags.length - 3}</span>}
                          </div>
                        )}
                        <div className="space-y-1.5 pt-2.5 border-t border-[rgba(99,102,241,0.08)]">
                          <div className="data-card-row"><span className="data-card-label">WhatsApp</span><span className="data-card-value">{maskPhone(user.whatsapp)}</span></div>
                          <div className="data-card-row"><span className="data-card-label">Tipe</span><span className="data-card-value">{getTypeBadge(user.customerType)}</span></div>
                          <div className="data-card-row"><span className="data-card-label">Total TRX</span><span className="data-card-value font-semibold">{user._count.transactions}</span></div>
                          <div className="data-card-row"><span className="data-card-label">Pembelian Terakhir</span><span className="data-card-value">{user.transactions[0] ? formatDate(user.transactions[0].purchaseDate) : '-'}</span></div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[rgba(99,102,241,0.08)]">
                          <button className="btn-icon" style={{ width: 30, height: 30 }} title="Lihat Detail" onClick={() => openUserTransactions(user)}><Eye size={14} /></button>
                          {user.whatsapp && (
                            <a href={`https://wa.me/${user.whatsapp.replace(/^0/, '62').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-icon" style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25d366' }} title="WhatsApp"><MessageCircle size={14} /></a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(99,102,241,0.08)]">
                <p className="text-sm text-[var(--text-muted)]">Total {total} pelanggan</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tag Popover Portal (rendered outside overflow container) ── */}
      {tagPopoverUserId && tagPopoverPos && typeof window !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="w-52 rounded-xl border border-[var(--border-color)] shadow-2xl overflow-hidden"
          style={{
            position: 'fixed',
            top: tagPopoverPos.top,
            right: tagPopoverPos.right,
            zIndex: 9999,
            background: "rgba(15,17,30,0.97)",
            backdropFilter: "blur(16px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const popUser = users.find(u => u.id === tagPopoverUserId);
            if (!popUser) return null;
            const popUserTagIds = new Set(popUser.tags?.map((t) => t.tag.id) || []);
            return (
              <>
                <div className="px-3 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2">
                  <Tag size={13} className="text-[#818cf8]" />
                  <p className="text-xs font-semibold text-white">Tag untuk {popUser.name.split(" ")[0]}</p>
                </div>
                {allTags.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
                    Belum ada tag.<br />
                    <button
                      onClick={() => { setShowTagManager(true); setTagPopoverUserId(null); setTagPopoverPos(null); }}
                      className="text-[#818cf8] underline mt-1.5 font-medium"
                    >
                      Buat tag dulu →
                    </button>
                  </div>
                ) : (
                  <div className="py-1 max-h-52 overflow-y-auto">
                    {allTags.map((tag) => {
                      const has = popUserTagIds.has(tag.id);
                      const isToggling = togglingTag === tag.id;
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTagOnUser(popUser.id, tag.id, has)}
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
                    onClick={() => { setShowTagManager(true); setTagPopoverUserId(null); setTagPopoverPos(null); }}
                    className="w-full text-xs text-[var(--text-muted)] hover:text-[#818cf8] transition-colors text-center"
                  >
                    + Buat tag baru
                  </button>
                </div>
              </>
            );
          })()}
        </div>,
        document.body
      )}

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

      {/* ════════════════════════════════════════════
          FILTER PANEL — Desktop Dropdown + Mobile Bottom Sheet
      ════════════════════════════════════════════ */}
      {showFilterPanel && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowFilterPanel(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 44,
              background: isMobile ? 'rgba(0,0,0,0.55)' : 'transparent',
            }}
          />

          {/* Panel */}
          <div
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            style={isMobile ? {
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45,
              borderRadius: '20px 20px 0 0', maxHeight: '88vh', overflowY: 'auto',
              background: 'rgba(13,15,27,0.99)', border: '1px solid rgba(99,102,241,0.2)',
              backdropFilter: 'blur(20px)',
            } : filterBtnRect ? {
              position: 'fixed',
              top: filterBtnRect.bottom + 8,
              left: Math.min(filterBtnRect.left, window.innerWidth - 396),
              width: 388, zIndex: 45, borderRadius: 16,
              background: 'rgba(13,15,27,0.99)', border: '1px solid rgba(99,102,241,0.25)',
              backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
            } : undefined}
          >
            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(99,102,241,0.12)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'rgba(13,15,27,0.99)', zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <SlidersHorizontal size={15} style={{ color:'#818cf8' }} />
                <span style={{ fontWeight:600, color:'white', fontSize:15 }}>Filter Pelanggan</span>
              </div>
              <button className="btn-icon" onClick={() => setShowFilterPanel(false)}><X size={16} /></button>
            </div>

            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:22 }}>

              {/* Status */}
              <div>
                <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Status Pelanggan</p>
                <div style={{ display:'flex', gap:6 }}>
                  {([{v:'all',l:'Semua'},{v:'active',l:'Aktif'},{v:'inactive',l:'Tidak Aktif'}] as const).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setDraftFilters(f => ({ ...f, status: opt.v }))}
                      style={{
                        padding:'6px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                        border:'1px solid', cursor:'pointer', transition:'all 0.15s',
                        background: draftFilters.status === opt.v ? 'rgba(99,102,241,0.2)' : 'transparent',
                        borderColor: draftFilters.status === opt.v ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                        color: draftFilters.status === opt.v ? '#818cf8' : 'var(--text-muted)',
                      }}
                    >{opt.l}</button>
                  ))}
                </div>
              </div>

              {/* Pembelian Terakhir */}
              <div>
                <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Pembelian Terakhir</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, display:'block' }}>Dari tanggal</label>
                    <input
                      type="date" className="form-input"
                      style={{ fontSize:12, padding:'7px 10px' }}
                      value={draftFilters.lastTrxFrom}
                      onChange={e => setDraftFilters(f => ({ ...f, lastTrxFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, display:'block' }}>Sampai tanggal</label>
                    <input
                      type="date" className="form-input"
                      style={{ fontSize:12, padding:'7px 10px' }}
                      value={draftFilters.lastTrxTo}
                      onChange={e => setDraftFilters(f => ({ ...f, lastTrxTo: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Total Transaksi */}
              <div>
                <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Total Transaksi</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, display:'block' }}>Minimal (≥)</label>
                    <input
                      type="number" className="form-input"
                      style={{ fontSize:12, padding:'7px 10px' }}
                      placeholder="0" min="0"
                      value={draftFilters.minTrx}
                      onChange={e => setDraftFilters(f => ({ ...f, minTrx: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, display:'block' }}>Maksimal (≤)</label>
                    <input
                      type="number" className="form-input"
                      style={{ fontSize:12, padding:'7px 10px' }}
                      placeholder="∞" min="0"
                      value={draftFilters.maxTrx}
                      onChange={e => setDraftFilters(f => ({ ...f, maxTrx: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Tag Multi-select */}
              {allTags.length > 0 && (
                <div>
                  <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Tag</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:180, overflowY:'auto' }}>
                    {allTags.map(tag => {
                      const selected = draftFilters.tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => setDraftFilters(f => ({
                            ...f,
                            tagIds: selected ? f.tagIds.filter(id=>id!==tag.id) : [...f.tagIds, tag.id],
                          }))}
                          style={{
                            display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                            borderRadius:9, cursor:'pointer', width:'100%', textAlign:'left',
                            border:'1px solid', transition:'all 0.15s',
                            borderColor: selected ? `${tag.color}55` : 'rgba(255,255,255,0.07)',
                            background: selected ? `${tag.color}18` : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          {/* Checkbox */}
                          <span style={{
                            width:15, height:15, borderRadius:4, flexShrink:0,
                            border: selected ? `2px solid ${tag.color}` : '2px solid rgba(255,255,255,0.2)',
                            background: selected ? tag.color : 'transparent',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            {selected && <Check size={9} style={{ color:'white' }} />}
                          </span>
                          <span style={{ width:10, height:10, borderRadius:'50%', background:tag.color, flexShrink:0 }} />
                          <span style={{ fontSize:13, color: selected ? 'white' : 'var(--text-secondary)', flex:1 }}>{tag.name}</span>
                          {tag._count && <span style={{ fontSize:10, color:'var(--text-muted)' }}>{tag._count.customers}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(99,102,241,0.1)', display:'flex', gap:8, justifyContent:'space-between', position:'sticky', bottom:0, background:'rgba(13,15,27,0.99)' }}>
              <button
                className="btn-secondary"
                onClick={() => setDraftFilters({ ...EMPTY_FILTERS })}
              >
                Reset
              </button>
              <button
                className="btn-primary"
                onClick={() => { setActiveFilters({ ...draftFilters }); setShowFilterPanel(false); }}
              >
                <Check size={14} /> Terapkan Filter
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
