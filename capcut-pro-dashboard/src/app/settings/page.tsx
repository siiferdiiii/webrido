"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
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
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppSettings {
  customer_active_days: string;
  template_followup: string;
  template_send_account: string;
  template_warranty: string;
  template_promo: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  customer_active_days: "60",
  template_followup: "",
  template_send_account: "",
  template_warranty: "",
  template_promo: "",
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
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [original, setOriginal] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof AppSettings>("template_followup");
  const [showPreview, setShowPreview] = useState(false);

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

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(original);

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
