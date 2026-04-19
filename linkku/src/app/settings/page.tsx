"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/context/AuthContext";
import { ALL_PERMISSIONS, PermissionKey, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/auth-shared";
import {
  Settings,
  Save,
  RotateCcw,
  ChevronRight,
  Users,
  MessageSquare,
  Send,
  Shield,
  Megaphone,
  Check,
  Loader2,
  Eye,
  Info,
  Clock,
  Tag,
  Plus,
  Trash2,
  Pencil,
  X,
  ShoppingBag,
  Smartphone,
  Monitor,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppSettings {
  customer_active_days: string;
  template_followup: string;
  template_send_account: string;
  template_warranty: string;
  template_promo: string;
  template_wa_expired: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
  _count?: { customers: number };
}

interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  type: string;
  features: string[];
  popular: boolean;
}

const PRESET_COLORS = [
  "#818cf8","#6366f1","#8b5cf6","#a855f7",
  "#ec4899","#ef4444","#f97316","#f59e0b",
  "#eab308","#84cc16","#22c55e","#10b981",
  "#14b8a6","#06b6d4","#3b82f6","#6b7280",
];

const DEFAULT_SETTINGS: AppSettings = {
  customer_active_days: "60",
  template_followup: "",
  template_send_account: "",
  template_warranty: "",
  template_promo: "",
  template_wa_expired: "",
};

// ─── Template Metadata ───────────────────────────────────────────────────────

const TEMPLATE_TABS = [
  {
    key: "template_followup" as keyof AppSettings,
    label: "Follow-Up",
    icon: Send,
    color: "#818cf8",
    description: "Pesan yang dikirim saat follow-up terjadwal berjalan",
    variables: ["{{nama}}", "{{email}}", "{{wa}}"],
    preview: { nama: "Kasmawati", email: "kas@gmail.com", wa: "085212345678" },
  },
  {
    key: "template_send_account" as keyof AppSettings,
    label: "Kirim Akun",
    icon: Shield,
    color: "#22c55e",
    description: "Pesan yang dikirim via webhook saat kirim akun setelah transaksi manual",
    variables: ["{{nama}}", "{{akun_email}}", "{{akun_password}}", "{{tipe}}", "{{durasi}}"],
    preview: {
      nama: "Kasmawati",
      akun_email: "capcut.pro@gmail.com",
      akun_password: "Pass@1234",
      tipe: "Mobile",
      durasi: "30",
    },
  },
  {
    key: "template_warranty" as keyof AppSettings,
    label: "Garansi",
    icon: Shield,
    color: "#f59e0b",
    description: "Pesan yang dikirim saat klaim garansi berhasil diproses",
    variables: ["{{nama}}", "{{akun_email}}", "{{akun_password}}"],
    preview: {
      nama: "Kasmawati",
      akun_email: "capcut.pro2@gmail.com",
      akun_password: "Pass@9999",
    },
  },
  {
    key: "template_promo" as keyof AppSettings,
    label: "Promo",
    icon: Megaphone,
    color: "#ec4899",
    description: "Pesan promo / broadcast ke pelanggan",
    variables: ["{{nama}}"],
    preview: { nama: "Kasmawati" },
  },
  {
    key: "template_wa_expired" as keyof AppSettings,
    label: "WA Popup Expired",
    icon: MessageSquare,
    color: "#22c55e",
    description: "Pesan WA saat klik tombol WA di popup filter masa aktif berakhir",
    variables: ["{{nama}}"],
    preview: { nama: "Kasmawati" },
  },
];

// ─── Helper: render template with preview data ────────────────────────────────

function renderPreview(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, val);
  }
  return result;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isDeveloper } = useAuth();

  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [original, setOriginal] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof AppSettings>("template_followup");
  const [showPreview, setShowPreview] = useState(false);

  // ── Tag state ──────────────────────────────────────────────────────────────
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [savingTag, setSavingTag] = useState(false);
  const [tagError, setTagError] = useState("");

  // ── Admin management state (developer only) ─────────────────────────────────
  interface AdminUserItem {
    id: string; email: string; name: string; role: string;
    status: string; permissions: Record<string, boolean> | null; createdAt: string;
  }
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);
  const [savingAdminId, setSavingAdminId] = useState<string | null>(null);
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  // Local permission edits per admin (before save)
  const [localPerms, setLocalPerms] = useState<Record<string, Record<string, boolean>>>({});

  // ── Product management state ──────────────────────────────────────────────
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editProductIdx, setEditProductIdx] = useState<number | null>(null);
  const [productForm, setProductForm] = useState<ProductItem>({
    id: "", name: "", description: "", price: 0, duration: 30, type: "mobile", features: [], popular: false,
  });
  const [featureInput, setFeatureInput] = useState("");
  const [savingProducts, setSavingProducts] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      setSettings({ ...DEFAULT_SETTINGS, ...json });
      setOriginal({ ...DEFAULT_SETTINGS, ...json });
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      const res = await fetch("/api/tags");
      const json = await res.json();
      setTags(json.tags || []);
    } catch (e) {
      console.error("Failed to load tags:", e);
    } finally {
      setLoadingTags(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  // ── Product fetch ─────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const json = await res.json();
      setProducts(json.products || []);
    } catch (e) { console.error(e); }
    setLoadingProducts(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(original);

  // ── Tag CRUD ───────────────────────────────────────────────────────────────

  async function handleCreateTag() {
    if (!newTagName.trim()) { setTagError("Nama label wajib diisi"); return; }
    setSavingTag(true); setTagError("");
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });
      const json = await res.json();
      if (!res.ok) { setTagError(json.error || "Gagal membuat label"); return; }
      setNewTagName("");
      setNewTagColor(PRESET_COLORS[0]);
      fetchTags();
    } catch { setTagError("Terjadi kesalahan"); }
    setSavingTag(false);
  }

  function startEditTag(tag: TagItem) {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setEditingColor(tag.color);
    setDeleteConfirmId(null);
    setTagError("");
  }

  async function handleUpdateTag() {
    if (!editingTagId || !editingName.trim()) return;
    setSavingTag(true); setTagError("");
    try {
      const res = await fetch(`/api/tags/${editingTagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim(), color: editingColor }),
      });
      const json = await res.json();
      if (!res.ok) { setTagError(json.error || "Gagal update label"); return; }
      setEditingTagId(null);
      fetchTags();
    } catch { setTagError("Terjadi kesalahan"); }
    setSavingTag(false);
  }

  async function handleDeleteTag(id: string) {
    setSavingTag(true);
    try {
      await fetch(`/api/tags/${id}`, { method: "DELETE" });
      setDeleteConfirmId(null);
      fetchTags();
    } catch { }
    setSavingTag(false);
  }

  // \u2500\u2500 Admin management functions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const fetchAdmins = useCallback(async () => {
    if (!isDeveloper) return;
    setLoadingAdmins(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      setAdminUsers(json.users || []);
      // Init localPerms from DB
      const permsMap: Record<string, Record<string, boolean>> = {};
      (json.users || []).forEach((u: { id: string; permissions: Record<string, boolean> | null }) => {
        permsMap[u.id] = u.permissions ? { ...u.permissions } : { ...DEFAULT_ADMIN_PERMISSIONS };
      });
      setLocalPerms(permsMap);
    } catch (e) { console.error(e); }
    setLoadingAdmins(false);
  }, [isDeveloper]);

  useEffect(() => { if (isDeveloper) fetchAdmins(); }, [fetchAdmins, isDeveloper]);

  async function handleGenerateInvite() {
    setGeneratingInvite(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_invite" }),
      });
      const json = await res.json();
      if (res.ok) { setInviteLink(json.inviteLink); setInviteExpiry(json.expiresAt); }
    } catch (e) { console.error(e); }
    setGeneratingInvite(false);
  }

  async function handleToggleAdminStatus(id: string, currentStatus: string) {
    setSavingAdminId(id);
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAdmins();
    } catch (e) { console.error(e); }
    setSavingAdminId(null);
  }

  async function handleSavePermissions(id: string) {
    setSavingAdminId(id);
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: localPerms[id] }),
      });
      fetchAdmins();
    } catch (e) { console.error(e); }
    setSavingAdminId(null);
  }

  async function handleDeleteAdmin(id: string) {
    setSavingAdminId(id);
    try {
      await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      setDeleteAdminId(null);
      fetchAdmins();
    } catch (e) { console.error(e); }
    setSavingAdminId(null);
  }

  function togglePerm(adminId: string, key: string) {
    setLocalPerms(prev => ({
      ...prev,
      [adminId]: { ...(prev[adminId] || {}), [key]: !(prev[adminId]?.[key] ?? false) },
    }));
  }

  async function handleSave() {

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setOriginal({ ...settings });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSettings({ ...original });
  }

  // ── Product CRUD ──────────────────────────────────────────────────────────
  function openAddProduct() {
    setEditProductIdx(null);
    setProductForm({
      id: "", name: "", description: "", price: 0,
      duration: 30, type: "mobile", features: [], popular: false,
    });
    setFeatureInput("");
  }

  function openEditProduct(idx: number) {
    setEditProductIdx(idx);
    setProductForm({ ...products[idx] });
    setFeatureInput("");
  }

  function addFeature() {
    if (!featureInput.trim()) return;
    setProductForm(p => ({ ...p, features: [...p.features, featureInput.trim()] }));
    setFeatureInput("");
  }

  function removeFeature(i: number) {
    setProductForm(p => ({ ...p, features: p.features.filter((_, idx) => idx !== i) }));
  }

  async function handleSaveProduct() {
    if (!productForm.name || !productForm.price) return;
    setSavingProducts(true);
    const updated = [...products];
    if (editProductIdx !== null) {
      updated[editProductIdx] = productForm;
    } else {
      updated.push(productForm);
    }
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: JSON.stringify(updated) }),
      });
      setProducts(updated);
      setEditProductIdx(null);
      setProductForm({ id: "", name: "", description: "", price: 0, duration: 30, type: "mobile", features: [], popular: false });
    } catch (e) { console.error(e); }
    setSavingProducts(false);
  }

  async function handleDeleteProduct(idx: number) {
    const updated = products.filter((_, i) => i !== idx);
    setSavingProducts(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: JSON.stringify(updated) }),
      });
      setProducts(updated);
    } catch (e) { console.error(e); }
    setSavingProducts(false);
  }

  const currentTab = TEMPLATE_TABS.find(t => t.key === activeTab);

  return (
    <>
      <Topbar title="Pengaturan" subtitle="Konfigurasi template pesan dan logika sistem" />

      <div className="px-4 md:px-8 pb-10 space-y-6">

        {/* ─── Save Bar ──────────────────────────────────────────────────────── */}
        {(isDirty || saved) && (
          <div
            className="flex items-center justify-between px-5 py-3 rounded-2xl"
            style={{
              background: saved
                ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))"
                : "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))",
              border: `1px solid ${saved ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.3)"}`,
            }}
          >
            <div className="flex items-center gap-2">
              {saved
                ? <Check size={16} className="text-emerald-400" />
                : <Info size={15} className="text-[#818cf8]" />}
              <span className="text-sm font-medium" style={{ color: saved ? "#22c55e" : "#a5b4fc" }}>
                {saved ? "Pengaturan berhasil disimpan!" : "Ada perubahan yang belum disimpan"}
              </span>
            </div>
            {!saved && (
              <div className="flex gap-2">
                <button className="btn-secondary h-8 px-3 text-xs" onClick={handleReset}>
                  <RotateCcw size={12} /> Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 h-8 rounded-lg text-xs font-semibold text-white transition-opacity"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", cursor: saving ? "wait" : "pointer" }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Simpan
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#818cf8]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">

            {/* ─── Left: Sections Menu ──────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Section: Customer Aktif */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(99,102,241,0.15)] flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-[#818cf8]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Customer Aktif</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Logika perhitungan status</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="form-label text-xs">Threshold Hari Aktif</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        className="form-input pr-16 text-center text-lg font-bold"
                        value={settings.customer_active_days}
                        onChange={e => setSettings(s => ({ ...s, customer_active_days: e.target.value }))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] font-medium">hari</span>
                    </div>
                  </div>
                  <div
                    className="p-3 rounded-xl text-xs leading-relaxed"
                    style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
                  >
                    <p className="font-semibold text-[#818cf8] mb-1 flex items-center gap-1.5">
                      <Clock size={11} /> Definisi saat ini:
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Pelanggan yang memiliki transaksi sukses dalam{" "}
                      <strong className="text-white">{settings.customer_active_days || "60"} hari</strong>{" "}
                      terakhir = <span className="text-emerald-400 font-semibold">Aktif</span>
                    </p>
                    <p className="text-[var(--text-muted)] mt-1">
                      Lebih dari itu = <span className="text-rose-400 font-semibold">Tidak Aktif</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Section: Label Pelanggan */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)" }}>
                    <Tag size={16} className="text-[#818cf8]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Label Pelanggan</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Buat &amp; kelola label untuk kategorisasi</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>{tags.length}</span>
                </div>

                {/* Existing Tags */}
                <div className="space-y-1.5 mb-3 max-h-60 overflow-y-auto pr-0.5">
                  {loadingTags ? (
                    <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-[#818cf8]" /></div>
                  ) : tags.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-3">Belum ada label. Buat yang pertama di bawah.</p>
                  ) : (
                    tags.map(tag => editingTagId === tag.id ? (
                      /* ── Edit mode ─────────────────────────── */
                      <div
                        key={tag.id}
                        className="p-2.5 rounded-xl space-y-2"
                        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
                      >
                        <input
                          className="form-input text-sm h-8 w-full"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          placeholder="Nama label"
                          autoFocus
                        />
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => setEditingColor(c)}
                              className="rounded transition-all"
                              style={{
                                width: 20, height: 20, background: c, flexShrink: 0,
                                outline: editingColor === c ? `2px solid white` : "none",
                                outlineOffset: 1,
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateTag}
                            disabled={savingTag}
                            className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-xs font-semibold"
                            style={{ background: `${editingColor}20`, border: `1px solid ${editingColor}40`, color: editingColor }}
                          >
                            {savingTag ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Simpan
                          </button>
                          <button
                            onClick={() => { setEditingTagId(null); setTagError(""); }}
                            className="flex items-center justify-center h-7 px-2 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)" }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ) : deleteConfirmId === tag.id ? (
                      /* ── Delete confirm ─────────────────────── */
                      <div
                        key={tag.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                      >
                        <span className="text-xs text-rose-300 flex-1">Hapus &ldquo;{tag.name}&rdquo;? ({tag._count?.customers || 0} pelanggan)</span>
                        <button onClick={() => handleDeleteTag(tag.id)} disabled={savingTag} className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors">
                          {savingTag ? <Loader2 size={11} className="animate-spin" /> : "Ya"}
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)} className="text-[11px] text-[var(--text-muted)] hover:text-white transition-colors">Batal</button>
                      </div>
                    ) : (
                      /* ── Normal row ─────────────────────────── */
                      <div
                        key={tag.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl group transition-colors hover:bg-white/[0.03]"
                        style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: tag.color }}
                        />
                        <span className="text-sm font-medium text-white flex-1 truncate">{tag.name}</span>
                        {(tag._count?.customers ?? 0) > 0 && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${tag.color}18`, color: tag.color }}
                          >
                            {tag._count!.customers} pelanggan
                          </span>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditTag(tag)}
                            className="btn-icon"
                            style={{ width: 26, height: 26 }}
                            title="Edit label"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => { setDeleteConfirmId(tag.id); setEditingTagId(null); }}
                            className="btn-icon hover:text-rose-400 hover:bg-rose-500/10"
                            style={{ width: 26, height: 26 }}
                            title="Hapus label"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Error */}
                {tagError && (
                  <p className="text-xs text-rose-400 mb-2">{tagError}</p>
                )}

                {/* Create New */}
                <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] space-y-2">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Buat Label Baru</p>
                  {/* Color picker */}
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewTagColor(c)}
                        className="rounded transition-all"
                        style={{
                          width: 20, height: 20, background: c, flexShrink: 0,
                          outline: newTagColor === c ? `2px solid white` : "none",
                          outlineOffset: 1,
                        }}
                      />
                    ))}
                  </div>
                  {/* Name input + add button */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="form-input text-sm flex-1"
                      placeholder="Nama label baru..."
                      value={newTagName}
                      onChange={e => { setNewTagName(e.target.value); setTagError(""); }}
                      onKeyDown={e => { if (e.key === "Enter") handleCreateTag(); }}
                    />
                    <button
                      onClick={handleCreateTag}
                      disabled={savingTag || !newTagName.trim()}
                      className="flex items-center justify-center gap-1.5 px-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                      style={{
                        background: `${newTagColor}22`,
                        border: `1px solid ${newTagColor}44`,
                        color: newTagColor,
                        minWidth: 72,
                      }}
                    >
                      {savingTag ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      {savingTag ? "" : "Tambah"}
                    </button>
                  </div>
                  {/* Preview of the new tag */}
                  {newTagName.trim() && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)]">Preview:</span>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: `${newTagColor}22`,
                          color: newTagColor,
                          border: `1px solid ${newTagColor}44`,
                        }}
                      >
                        {newTagName.trim()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Template Tabs */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(129,140,248,0.15)] flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={16} className="text-[#818cf8]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Template Pesan</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Pilih untuk edit</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {TEMPLATE_TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    const hasChange = settings[tab.key] !== original[tab.key];
                    return (
                      <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setShowPreview(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                        style={{
                          background: isActive ? `${tab.color}15` : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isActive ? `${tab.color}35` : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${tab.color}20` }}
                        >
                          <Icon size={14} style={{ color: tab.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white flex items-center gap-1.5">
                            {tab.label}
                            {hasChange && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                              >
                                edited
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{tab.description}</p>
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0" style={{ color: isActive ? tab.color : undefined }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save button always visible */}
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-all"
                style={{
                  background: isDirty
                    ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isDirty ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: isDirty ? "white" : "var(--text-muted)",
                  cursor: saving || !isDirty ? "not-allowed" : "pointer",
                  boxShadow: isDirty ? "0 4px 20px rgba(99,102,241,0.3)" : "none",
                }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
                {saving ? "Menyimpan..." : saved ? "Tersimpan!" : "Simpan Semua Pengaturan"}
              </button>

              {/* ─── Admin Management (Developer only) ────────────────────── */}
              {isDeveloper && (
                <div className="glass-card p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,158,11,0.15)" }}>
                      <Shield size={16} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Manajemen Admin</p>
                      <p className="text-[11px] text-[var(--text-muted)]">Kelola akun & hak akses</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                      {adminUsers.filter(u => u.role === "admin").length} admin
                    </span>
                  </div>

                  {/* Invite Link Generator */}
                  <div className="p-3 rounded-xl space-y-2" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Undang Admin Baru</p>
                    <button
                      onClick={handleGenerateInvite}
                      disabled={generatingInvite}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}
                    >
                      {generatingInvite ? <Loader2 size={13} className="animate-spin" /> : <Settings size={13} />}
                      Generate Invite Link (24 jam)
                    </button>
                    {inviteLink && (
                      <div className="space-y-1.5">
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <span className="text-[11px] font-mono text-[var(--text-muted)] flex-1 truncate">{inviteLink}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(inviteLink); setCopiedInvite(true); setTimeout(() => setCopiedInvite(false), 2000); }}
                            className="text-[11px] font-semibold flex-shrink-0"
                            style={{ color: copiedInvite ? "#22c55e" : "#818cf8" }}
                          >
                            {copiedInvite ? <Check size={13} /> : <ChevronRight size={13} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          Kadaluarsa: {new Date(inviteExpiry).toLocaleString("id-ID")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Admin Users List */}
                  {loadingAdmins ? (
                    <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-amber-400" /></div>
                  ) : (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
                      {adminUsers.filter(u => u.role === "admin").length === 0 && (
                        <p className="text-xs text-[var(--text-muted)] text-center py-3">Belum ada akun admin.</p>
                      )}

                      {adminUsers.filter(u => u.role === "admin").map(admin => {
                        const isExpanded = expandedAdminId === admin.id;
                        const perms = localPerms[admin.id] || DEFAULT_ADMIN_PERMISSIONS;
                        const isSaving = savingAdminId === admin.id;

                        return (
                          <div key={admin.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                            {/* Admin row header */}
                            <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
                              {/* Avatar */}
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: admin.status === "active" ? "var(--gradient-primary)" : "rgba(255,255,255,0.1)" }}>
                                {admin.name.slice(0, 2).toUpperCase()}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{admin.name}</p>
                                <p className="text-[10px] text-[var(--text-muted)] truncate">{admin.email}</p>
                              </div>
                              {/* Status toggle */}
                              <button
                                onClick={() => handleToggleAdminStatus(admin.id, admin.status)}
                                disabled={isSaving}
                                className="flex-shrink-0 w-9 h-5 rounded-full transition-all relative"
                                style={{ background: admin.status === "active" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)", border: `1px solid ${admin.status === "active" ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.15)"}` }}
                                title={admin.status === "active" ? "Klik untuk nonaktifkan" : "Klik untuk aktifkan"}
                              >
                                <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{
                                  background: admin.status === "active" ? "#22c55e" : "rgba(255,255,255,0.3)",
                                  left: admin.status === "active" ? "calc(100% - 18px)" : "2px",
                                }} />
                              </button>
                              {/* Expand/collapse permissions */}
                              <button
                                onClick={() => setExpandedAdminId(isExpanded ? null : admin.id)}
                                className="btn-icon flex-shrink-0"
                                style={{ width: 26, height: 26 }}
                                title="Atur izin"
                              >
                                <ChevronRight size={13} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                              {/* Delete */}
                              {deleteAdminId === admin.id ? (
                                <div className="flex gap-1">
                                  <button onClick={() => handleDeleteAdmin(admin.id)} disabled={isSaving}
                                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300">
                                    {isSaving ? <Loader2 size={11} className="animate-spin" /> : "Hapus"}
                                  </button>
                                  <button onClick={() => setDeleteAdminId(null)} className="text-[11px] text-[var(--text-muted)]">Batal</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteAdminId(admin.id)} className="btn-icon hover:text-rose-400 hover:bg-rose-500/10 flex-shrink-0" style={{ width: 26, height: 26 }}>
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>

                            {/* Permissions panel */}
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-2">
                                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Hak Akses</p>
                                <div className="grid grid-cols-1 gap-1">
                                  {(Object.entries(ALL_PERMISSIONS) as [PermissionKey, string][]).map(([key, label]) => {
                                    const isOn = perms[key] ?? false;
                                    return (
                                      <label key={key} className="flex items-center gap-2.5 cursor-pointer py-1 group">
                                        {/* Toggle */}
                                        <div
                                          onClick={() => togglePerm(admin.id, key)}
                                          className="w-8 h-4 rounded-full relative flex-shrink-0 transition-all cursor-pointer"
                                          style={{ background: isOn ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)", border: `1px solid ${isOn ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}` }}
                                        >
                                          <span className="absolute top-0.5 w-3 h-3 rounded-full transition-all" style={{
                                            background: isOn ? "#818cf8" : "rgba(255,255,255,0.25)",
                                            left: isOn ? "calc(100% - 14px)" : "2px",
                                          }} />
                                        </div>
                                        <span className={`text-xs ${isOn ? "text-white" : "text-[var(--text-muted)]"}`}>{label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <button
                                  onClick={() => handleSavePermissions(admin.id)}
                                  disabled={isSaving}
                                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                                  style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.35)", color: "#818cf8" }}
                                >
                                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  Simpan Izin
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Developer Account info */}
                      {adminUsers.filter(u => u.role === "developer").map(dev => (
                        <div key={dev.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl opacity-60" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
                          <Shield size={14} className="text-amber-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{dev.name} <span className="text-amber-400">(Developer)</span></p>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">{dev.email}</p>
                          </div>
                          <span className="text-[10px] text-amber-400 font-semibold">Full Access</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Product Catalog Management ─────────────────────────────── */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)" }}>
                    <ShoppingBag size={16} className="text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Katalog Produk</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Produk yang tampil di marketplace</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>{products.length}</span>
                </div>

                {loadingProducts ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-emerald-400" /></div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                    {products.map((product, idx) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl group transition-colors hover:bg-white/[0.03]"
                        style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: product.type === "desktop" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)" }}>
                          {product.type === "desktop" ? <Monitor size={13} style={{ color: "#3b82f6" }} /> : <Smartphone size={13} style={{ color: "#22c55e" }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">{product.name}</p>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{product.id}</span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            Rp {product.price.toLocaleString("id-ID")} · {product.duration} hari
                            {product.popular && <span className="ml-1 text-amber-400">⭐</span>}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditProduct(idx)} className="btn-icon" style={{ width: 26, height: 26 }} title="Edit">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDeleteProduct(idx)} className="btn-icon hover:text-rose-400 hover:bg-rose-500/10" style={{ width: 26, height: 26 }} title="Hapus">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {products.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] text-center py-3">Belum ada produk. Tambah di bawah.</p>
                    )}
                  </div>
                )}

                {/* Add Product Button */}
                <button
                  onClick={openAddProduct}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
                >
                  <Plus size={13} /> Tambah Produk
                </button>

                {/* Product Edit Form (inline) */}
                {(editProductIdx !== null || productForm.name !== undefined) && (editProductIdx !== null || productForm.id === "") && (
                  <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      {editProductIdx !== null ? "Edit Produk" : "Produk Baru"}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label text-[10px]">Kode SKU</label>
                        <input type="text" className="form-input text-sm font-mono uppercase" value={productForm.id} onChange={e => setProductForm(p => ({ ...p, id: e.target.value.toUpperCase().replace(/\s+/g, '-') }))} placeholder="CPM-30" />
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Harga (Rp)</label>
                        <input type="number" className="form-input text-sm" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>

                    <div>
                      <label className="form-label text-[10px]">Nama Produk</label>
                      <input type="text" className="form-input text-sm" value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} placeholder="CapCut Pro Mobile" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label text-[10px]">Tipe</label>
                        <select className="form-input text-sm" value={productForm.type} onChange={e => setProductForm(p => ({ ...p, type: e.target.value }))}>
                          <option value="mobile">Mobile</option>
                          <option value="desktop">Desktop</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-[10px]">Durasi (Hari)</label>
                        <input type="number" className="form-input text-sm" value={productForm.duration} onChange={e => setProductForm(p => ({ ...p, duration: parseInt(e.target.value) || 30 }))} />
                      </div>
                    </div>

                    <div>
                      <label className="form-label text-[10px]">Deskripsi</label>
                      <input type="text" className="form-input text-sm" value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} placeholder="Akses premium selama 30 hari" />
                    </div>

                    {/* Features */}
                    <div>
                      <label className="form-label text-[10px]">Fitur</label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {productForm.features.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
                            {f}
                            <button onClick={() => removeFeature(i)} style={{ cursor: "pointer" }}><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input type="text" className="form-input text-sm flex-1" value={featureInput} onChange={e => setFeatureInput(e.target.value)} placeholder="Tambah fitur..." onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }} />
                        <button onClick={addFeature} className="btn-icon" style={{ width: 32, height: 32 }}><Plus size={14} /></button>
                      </div>
                    </div>

                    {/* Popular toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={productForm.popular} onChange={e => setProductForm(p => ({ ...p, popular: e.target.checked }))} style={{ accentColor: "#22c55e" }} />
                      <span className="text-xs text-[var(--text-secondary)]">Tandai sebagai Best Seller</span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveProduct}
                        disabled={savingProducts || !productForm.name || !productForm.price || !productForm.id}
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e" }}
                      >
                        {savingProducts ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {editProductIdx !== null ? "Update" : "Simpan"}
                      </button>
                      <button
                        onClick={() => { setEditProductIdx(null); setProductForm({ id: "", name: "", description: "", price: 0, duration: 30, type: "mobile", features: [], popular: false }); }}
                        className="flex items-center justify-center h-8 px-3 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)" }}
                      >
                        <X size={12} /> Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Right: Template Editor ───────────────────────────────────── */}
            {currentTab && (

              <div className="glass-card overflow-hidden flex flex-col" style={{ minHeight: 520 }}>
                {/* Header */}
                <div
                  className="px-6 py-4 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(99,102,241,0.1)", background: `${currentTab.color}08` }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${currentTab.color}20` }}
                    >
                      <currentTab.icon size={17} style={{ color: currentTab.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Template {currentTab.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{currentTab.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPreview(p => !p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: showPreview ? `${currentTab.color}20` : "rgba(255,255,255,0.05)",
                      border: `1px solid ${showPreview ? `${currentTab.color}40` : "rgba(255,255,255,0.1)"}`,
                      color: showPreview ? currentTab.color : "var(--text-secondary)",
                    }}
                  >
                    <Eye size={13} /> {showPreview ? "Tutup Preview" : "Preview"}
                  </button>
                </div>

                <div className={`flex-1 grid ${showPreview ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                  {/* Editor */}
                  <div className="flex flex-col p-5 gap-4">
                    {/* Variable chips */}
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                        Variabel yang tersedia — klik untuk sisipkan
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {currentTab.variables.map(v => (
                          <button
                            key={v}
                            onClick={() => setSettings(s => ({
                              ...s,
                              [currentTab.key]: (s[currentTab.key] || "") + v,
                            }))}
                            className="text-[11px] font-mono px-2 py-0.5 rounded-md transition-all hover:opacity-80"
                            style={{
                              background: `${currentTab.color}18`,
                              border: `1px solid ${currentTab.color}35`,
                              color: currentTab.color,
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Textarea */}
                    <div className="flex-1">
                      <textarea
                        className="form-input w-full resize-none font-mono text-sm leading-relaxed"
                        style={{ height: "calc(100vh - 460px)", minHeight: 260 }}
                        placeholder={`Tulis template pesan ${currentTab.label} di sini...\n\nGunakan variabel seperti {{nama}} untuk data dinamis.`}
                        value={settings[currentTab.key]}
                        onChange={e => setSettings(s => ({ ...s, [currentTab.key]: e.target.value }))}
                      />
                    </div>

                    <p className="text-[10px] text-[var(--text-muted)]">
                      {(settings[currentTab.key] || "").length} karakter · Variabel <code className="text-[var(--text-secondary)]">{"{{nama}}"}</code> akan diganti otomatis saat pesan dikirim
                    </p>
                  </div>

                  {/* Preview panel */}
                  {showPreview && (
                    <div
                      className="flex flex-col p-5 gap-3"
                      style={{ borderLeft: "1px solid rgba(99,102,241,0.1)", background: "rgba(0,0,0,0.2)" }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: currentTab.color }}
                        />
                        <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                          Preview dengan data contoh
                        </p>
                      </div>

                      {/* WhatsApp-like bubble */}
                      <div className="flex-1 overflow-y-auto">
                        <div
                          className="p-4 rounded-2xl rounded-tl-sm max-w-xs ml-auto text-sm leading-relaxed whitespace-pre-wrap break-words"
                          style={{ background: "#1e5631", color: "white", fontFamily: "system-ui" }}
                        >
                          {renderPreview(settings[currentTab.key] || `(Template kosong)`, currentTab.preview as unknown as Record<string, string>)}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] text-right mt-1">✓ Terkirim</p>
                      </div>

                      {/* Preview data used */}
                      <div
                        className="p-3 rounded-xl"
                        style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}
                      >
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Data contoh</p>
                        {Object.entries(currentTab.preview).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-[11px]">
                            <span className="font-mono text-[var(--text-muted)]">{`{{${k}}}`}</span>
                            <span className="text-[var(--text-secondary)]">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
