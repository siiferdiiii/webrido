"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Plus,
  CalendarClock,
  Send,
  X,
  Trash2,
  Check,
  Loader2,
  Eye,
  Users,
  MessageCircle,
  UserPlus,
  Search,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Recipient {
  id: string;
  whatsappNumber: string;
  customerName: string | null;
  status: string;
  sentAt: string | null;
}

interface Followup {
  id: string;
  title: string;
  messageTemplate: string;
  scheduledAt: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  createdAt: string;
  _count?: { recipients: number };
  recipients?: Recipient[];
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
}

export default function FollowupPage() {
  const { maskPhone, maskEmail } = usePrivacy();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Followup | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formTemplate, setFormTemplate] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formRecipients, setFormRecipients] = useState<{ name: string; phone: string }[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Customer picker
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customers, setCustomers] = useState<UserItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/followups?${params}`);
    const data = await res.json();
    setFollowups(data.followups || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchFollowups(); }, [fetchFollowups]);

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
    if (showCustomerPicker) fetchCustomers();
  }, [showCustomerPicker, fetchCustomers]);

  const addManualRecipient = () => {
    if (!manualPhone.trim()) return;
    const phone = manualPhone.trim().replace(/^0/, "62").replace(/\D/g, "");
    const name = manualName.trim() || phone;
    if (formRecipients.some((r) => r.phone === phone)) return;
    setFormRecipients([...formRecipients, { name, phone }]);
    setManualName("");
    setManualPhone("");
  };

  const addCustomerRecipient = (user: UserItem) => {
    if (!user.whatsapp) return;
    const phone = user.whatsapp.replace(/^0/, "62").replace(/\D/g, "");
    if (formRecipients.some((r) => r.phone === phone)) return;
    setFormRecipients([...formRecipients, { name: user.name, phone }]);
  };

  const removeRecipient = (index: number) => {
    setFormRecipients(formRecipients.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!formTitle || !formTemplate || !formDate || formRecipients.length === 0) return;
    setSubmitting(true);
    const recipients = formRecipients.map((r) => ({
      whatsappNumber: r.phone,
      customerName: r.name,
    }));
    await fetch("/api/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: formTitle, messageTemplate: formTemplate, scheduledAt: formDate, recipients }),
    });
    setShowForm(false);
    resetForm();
    setSubmitting(false);
    fetchFollowups();
  };

  const resetForm = () => {
    setFormTitle(""); setFormTemplate(""); setFormDate(""); setFormRecipients([]); setManualName(""); setManualPhone("");
  };

  const handleViewDetail = async (id: string) => {
    const res = await fetch(`/api/followups/${id}`);
    const data = await res.json();
    setShowDetail(data.followup);
  };

  const handleCancel = async (id: string) => {
    await fetch(`/api/followups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    fetchFollowups();
    if (showDetail?.id === id) setShowDetail(null);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/followups/${id}`, { method: "DELETE" });
    fetchFollowups();
    if (showDetail?.id === id) setShowDetail(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { pending: "badge-warning", processing: "badge-info", completed: "badge-success", cancelled: "badge-danger" };
    const labels: Record<string, string> = { pending: "Menunggu", processing: "Berjalan", completed: "Selesai", cancelled: "Dibatalkan" };
    return <span className={`badge ${map[status] || "badge-neutral"}`}>{labels[status] || status}</span>;
  };

  const previewTemplate = (template: string, name: string) => template.replace(/\{\{nama_customer\}\}/gi, name || "Kak");

  return (
    <div>
      <Topbar title="Follow-Up Terjadwal" subtitle="Jadwalkan pengiriman pesan WA ke banyak penerima">
        <button onClick={() => { setShowForm(true); resetForm(); }} className="btn-primary">
          <Plus size={16} /> Buat Jadwal
        </button>
      </Topbar>

      <div className="px-8 pb-8 space-y-5">
        {/* Filter Pills */}
        <div className="filter-pills">
          {[
            { val: "", label: "Semua" },
            { val: "pending", label: "Menunggu" },
            { val: "processing", label: "Berjalan" },
            { val: "completed", label: "Selesai" },
            { val: "cancelled", label: "Dibatalkan" },
          ].map((s) => (
            <button key={s.val} onClick={() => setStatusFilter(s.val)}
              className={`filter-pill ${statusFilter === s.val ? "active" : ""}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[var(--accent-indigo)]" size={32} />
          </div>
        ) : followups.length === 0 ? (
          <div className="glass-card text-center py-16">
            <CalendarClock size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
            <p className="text-[var(--text-secondary)] font-medium">Belum ada jadwal follow-up</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Klik &quot;Buat Jadwal&quot; untuk memulai</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Dijadwalkan</th>
                  <th>Penerima</th>
                  <th>Progres</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {followups.map((f) => {
                  const total = f._count?.recipients || f.totalRecipients || 0;
                  const sent = f.sentCount || 0;
                  const pct = total ? Math.round((sent / total) * 100) : 0;
                  return (
                    <tr key={f.id}>
                      <td className="font-medium text-white">{f.title}</td>
                      <td className="text-sm">{new Date(f.scheduledAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td><span className="flex items-center gap-1.5 text-sm"><Users size={14} className="text-[var(--text-muted)]" />{total}</span></td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-24 h-[6px] bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : "var(--accent-indigo, #818cf8)" }} />
                          </div>
                          <span className="text-xs text-[var(--text-muted)] tabular-nums">{sent}/{total}</span>
                        </div>
                      </td>
                      <td>{statusBadge(f.status || "pending")}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => handleViewDetail(f.id)} className="btn-icon" style={{ width: 32, height: 32 }} title="Lihat Detail"><Eye size={15} /></button>
                          {f.status === "pending" && <button onClick={() => handleCancel(f.id)} className="btn-icon" style={{ width: 32, height: 32 }} title="Batalkan"><X size={15} /></button>}
                          {(f.status === "cancelled" || f.status === "completed") && <button onClick={() => handleDelete(f.id)} className="btn-icon" style={{ width: 32, height: 32 }} title="Hapus"><Trash2 size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== MODAL DETAIL ========== */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="text-lg font-semibold text-white">{showDetail.title}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {new Date(showDetail.scheduledAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setShowDetail(null)}><X size={18} /></button>
            </div>

            <div className="modal-body space-y-5">
              {/* Template */}
              <div className="p-4 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  <MessageCircle size={12} /> Template Pesan
                </p>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{showDetail.messageTemplate}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">{"{{nama_customer}}"} → otomatis diganti nama penerima</p>
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${showDetail.totalRecipients ? ((showDetail.sentCount || 0) / showDetail.totalRecipients) * 100 : 0}%`,
                      background: (showDetail.sentCount || 0) >= showDetail.totalRecipients ? "#22c55e" : "var(--accent-indigo, #818cf8)",
                    }} />
                </div>
                <span className="text-sm font-semibold text-white tabular-nums">{showDetail.sentCount || 0}/{showDetail.totalRecipients}</span>
                {(showDetail.sentCount || 0) >= showDetail.totalRecipients && showDetail.totalRecipients > 0 && (
                  <span className="badge badge-success text-[10px]"><CheckCircle size={10} /> Semua terkirim!</span>
                )}
              </div>

              {/* Daftar Penerima */}
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Daftar Penerima ({showDetail.recipients?.length || 0})
                </p>
                <div className="space-y-2">
                  {showDetail.recipients?.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl transition-all"
                      style={{
                        background: r.status === "sent" ? "rgba(34,197,94,0.06)" : "var(--bg-secondary)",
                        border: `1px solid ${r.status === "sent" ? "rgba(34,197,94,0.2)" : "var(--border-color)"}`,
                      }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${r.status === "sent" ? "bg-emerald-500/15" : "bg-[rgba(99,102,241,0.1)]"}`}>
                          {r.status === "sent" ? <CheckCircle size={15} className="text-emerald-400" /> : <Clock size={15} className="text-[var(--text-muted)]" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{r.customerName || "—"}</p>
                          <p className="text-xs text-[var(--text-muted)] font-mono">{maskPhone(r.whatsappNumber)}</p>
                        </div>
                      </div>
                      {r.status === "sent" ? (
                        <span className="badge badge-success text-[11px]"><Check size={11} /> Terkirim</span>
                      ) : r.status === "failed" ? (
                        <span className="badge badge-danger text-[11px]"><X size={11} /> Gagal</span>
                      ) : (
                        <span className="badge badge-primary text-[11px] opacity-70"><Loader2 size={10} className="animate-spin inline mr-1" /> Diproses n8n</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL BUAT JADWAL ========== */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white text-lg">Buat Jadwal Follow-Up</h3>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div className="modal-body space-y-5">
              {/* Judul */}
              <div>
                <label className="form-label">Judul Follow-Up</label>
                <input type="text" className="form-input" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Contoh: Follow-up Batch Maret" />
              </div>

              {/* Template Pesan */}
              <div>
                <label className="form-label">Template Pesan</label>
                <textarea className="form-input" rows={4} value={formTemplate} onChange={(e) => setFormTemplate(e.target.value)}
                  placeholder={"Halo {{nama_customer}}.\nKami ingin menginformasikan..."} style={{ resize: "none" }} />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-[var(--text-muted)]">Variabel:</span>
                  <button type="button" onClick={() => setFormTemplate(formTemplate + "{{nama_customer}}")}
                    className="badge badge-purple text-[11px] cursor-pointer hover:opacity-80 transition-opacity">
                    {"{{nama_customer}}"}
                  </button>
                </div>
                {formTemplate && formRecipients.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                    <p className="text-[11px] text-emerald-400 font-semibold mb-1">📱 Preview untuk {formRecipients[0].name}:</p>
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{previewTemplate(formTemplate, formRecipients[0].name)}</p>
                  </div>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="form-label">Tanggal & Jam Kirim</label>
                <input type="datetime-local" className="form-input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>

              {/* Daftar Penerima */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label !mb-0">Daftar Penerima ({formRecipients.length})</label>
                  <button type="button" onClick={() => { setShowCustomerPicker(true); setCustomerSearch(""); }}
                    className="badge badge-info cursor-pointer hover:opacity-80 transition-opacity text-[11px]">
                    <Users size={11} /> Pilih dari Customer
                  </button>
                </div>

                {/* Input Manual */}
                <div className="flex items-center gap-2 mb-3">
                  <input type="text" className="form-input !py-2 text-sm" style={{ flex: 1 }} value={manualName} onChange={(e) => setManualName(e.target.value)}
                    placeholder="Nama"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("fu-phone")?.focus(); } }} />
                  <input id="fu-phone" type="text" className="form-input !py-2 text-sm" style={{ flex: 1 }} value={manualPhone} onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="628xxx / 08xxx"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualRecipient(); } }} />
                  <button type="button" onClick={addManualRecipient} className="btn-primary !p-2 flex-shrink-0" title="Tambah">
                    <UserPlus size={16} />
                  </button>
                </div>

                {/* Daftar */}
                {formRecipients.length > 0 ? (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-xl p-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                    {formRecipients.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[rgba(99,102,241,0.06)] transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent-indigo, #818cf8)" }}>{i + 1}</span>
                          <span className="text-sm text-white font-medium truncate">{r.name}</span>
                          <span className="text-xs text-[var(--text-muted)] font-mono">{r.phone}</span>
                        </div>
                        <button type="button" onClick={() => removeRecipient(i)} className="btn-icon" style={{ width: 24, height: 24 }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px dashed var(--border-color)" }}>
                    <Users size={24} className="mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-xs text-[var(--text-muted)]">Belum ada penerima.</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Ketik nama & nomor di atas, atau pilih dari daftar customer.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button className="btn-primary" onClick={handleCreate}
                disabled={submitting || !formTitle || !formTemplate || !formDate || formRecipients.length === 0}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
                {submitting ? "Menyimpan..." : `Simpan Jadwal (${formRecipients.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL PILIH CUSTOMER ========== */}
      {showCustomerPicker && (
        <div className="modal-overlay" style={{ zIndex: 60 }} onClick={() => setShowCustomerPicker(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold text-white">Pilih dari Customer</h3>
              <button className="btn-icon" onClick={() => setShowCustomerPicker(false)}><X size={16} /></button>
            </div>

            <div className="modal-body" style={{ padding: "16px 24px" }}>
              {/* Search */}
              <div className="search-box mb-3">
                <Search size={14} className="search-icon" />
                <input type="text" className="form-input !pl-9 !py-2 text-sm" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Cari nama atau nomor..." />
              </div>

              {/* List */}
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-[var(--accent-indigo)]" size={20} /></div>
                ) : customers.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-muted)] py-8">Tidak ada customer ditemukan</p>
                ) : (
                  customers.filter((c) => c.whatsapp).map((c) => {
                    const phone = c.whatsapp!.replace(/^0/, "62").replace(/\D/g, "");
                    const isAdded = formRecipients.some((r) => r.phone === phone);
                    return (
                      <button key={c.id} onClick={() => { if (!isAdded) addCustomerRecipient(c); }} disabled={isAdded}
                        className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all hover:bg-[rgba(99,102,241,0.06)]"
                        style={{ border: "1px solid var(--border-color)", opacity: isAdded ? 0.5 : 1 }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{maskPhone(c.whatsapp)} · {maskEmail(c.email)}</p>
                        </div>
                        {isAdded ? (
                          <span className="badge badge-success text-[10px] flex-shrink-0"><Check size={10} /> Added</span>
                        ) : (
                          <Plus size={16} className="text-[var(--accent-indigo)] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-primary w-full" onClick={() => setShowCustomerPicker(false)}>
                Selesai ({formRecipients.length} penerima)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
