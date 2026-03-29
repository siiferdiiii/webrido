"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { usePrivacy } from "@/context/PrivacyContext";
import {
  Search,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";

interface MessageItem {
  id: string;
  whatsappNumber: string;
  messageType: string;
  messageContent: string | null;
  status: string | null;
  sentAt: string | null;
  user: { name: string } | null;
  transaction: { id: string; lynkIdRef: string | null } | null;
}

const typeLabels: Record<string, { label: string; badge: string }> = {
  account_delivery: { label: "Kirim Akun", badge: "badge-info" },
  follow_up_1: { label: "Follow Up 1", badge: "badge-warning" },
  follow_up_2: { label: "Follow Up 2", badge: "badge-warning" },
  follow_up_3: { label: "Follow Up 3", badge: "badge-danger" },
  cold: { label: "Cold Promo", badge: "badge-neutral" },
  project_only: { label: "Project Promo", badge: "badge-purple" },
  warranty_replacement: { label: "Ganti Garansi", badge: "badge-success" },
};

const typeFilterOptions = ["Semua", "Kirim Akun", "Follow Up", "Ganti Garansi"];

function getStatusIcon(status: string | null) {
  switch (status) {
    case "sent": return <CheckCircle size={14} className="text-emerald-400" />;
    case "failed": return <XCircle size={14} className="text-rose-400" />;
    case "delivered": return <CheckCircle size={14} className="text-cyan-400" />;
    default: return <Clock size={14} className="text-amber-400" />;
  }
}

export default function MessagesPage() {
  const { maskPhone } = usePrivacy();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Semua");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter === "Kirim Akun") params.set("type", "account_delivery");
    else if (typeFilter === "Follow Up") params.set("type", "follow_up");
    else if (typeFilter === "Ganti Garansi") params.set("type", "warranty");

    fetch(`/api/messages?${params}`)
      .then((res) => res.json())
      .then((json) => { setMessages(json.messages || []); setTotal(json.total || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleResend(msg: MessageItem) {
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: msg.user ? undefined : undefined,
        whatsappNumber: msg.whatsappNumber,
        messageType: msg.messageType,
        messageContent: msg.messageContent,
        status: "sent",
      }),
    });
    // Buka WhatsApp
    const waUrl = `https://wa.me/${msg.whatsappNumber.replace(/^0/, "62")}?text=${encodeURIComponent(msg.messageContent || "")}`;
    window.open(waUrl, "_blank");
    fetchData();
  }

  return (
    <>
      <Topbar title="Riwayat Pesan" subtitle="Log pengiriman pesan WhatsApp ke pelanggan" />

      <div className="px-8 pb-8 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="search-box flex-1 max-w-md">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Cari nama atau nomor WA..." className="form-input !pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-pills">
            {typeFilterOptions.map((f) => (
              <button key={f} className={`filter-pill ${typeFilter === f ? "active" : ""}`} onClick={() => setTypeFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#818cf8]" /><span className="ml-2 text-[var(--text-secondary)]">Memuat...</span></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Penerima</th>
                      <th>Nomor WA</th>
                      <th>Tipe Pesan</th>
                      <th>Isi Pesan</th>
                      <th>Status</th>
                      <th>Waktu Kirim</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-[var(--text-muted)]">Belum ada riwayat pesan</td></tr>
                    ) : (
                      messages.map((msg) => (
                        <tr key={msg.id}>
                          <td className="font-medium">{msg.user?.name || "-"}</td>
                          <td className="text-sm">{maskPhone(msg.whatsappNumber)}</td>
                          <td>
                            <span className={`badge ${typeLabels[msg.messageType]?.badge || "badge-neutral"}`}>
                              {typeLabels[msg.messageType]?.label || msg.messageType}
                            </span>
                          </td>
                          <td className="max-w-[250px] truncate text-sm text-[var(--text-secondary)]">{msg.messageContent || "-"}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(msg.status)}
                              <span className="text-sm capitalize">{msg.status === "sent" ? "Terkirim" : msg.status === "failed" ? "Gagal" : msg.status || "-"}</span>
                            </div>
                          </td>
                          <td className="text-[var(--text-secondary)] text-sm whitespace-nowrap">{msg.sentAt ? new Date(msg.sentAt).toLocaleString("id-ID") : "-"}</td>
                          <td>
                            {msg.status === "failed" && (
                              <button className="btn-success btn-sm" title="Kirim Ulang" onClick={() => handleResend(msg)}>
                                <RotateCcw size={14} /> Resend
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(99,102,241,0.08)]">
                <p className="text-sm text-[var(--text-muted)]">Total {total} pesan</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
