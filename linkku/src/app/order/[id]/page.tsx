"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck, Copy, CheckCircle, Clock, AlertTriangle,
  Package, CreditCard, Calendar, Mail, Lock, ArrowRight,
  ChevronDown, ChevronUp, RefreshCw, ArrowLeft, Shield, Sparkles
} from "lucide-react";
import Link from "next/link";

interface OrderData {
  id: string;
  productName: string;
  amount: number;
  status: string;
  purchaseDate: string;
  warrantyExpiredAt: string | null;
  warrantyActive: boolean;
  customer: { name: string; email: string; whatsapp: string } | null;
  account: { email: string; password: string; type: string; duration: number } | null;
  warrantyClaims: Array<{
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    oldAccount: { email: string; password: string } | null;
    newAccount: { email: string; password: string } | null;
  }>;
}

const CLAIM_REASONS = [
  "Akun tidak bisa login",
  "Akun terkena banned",
  "Akun error / masalah teknis",
  "Fitur premium tidak aktif",
  "Lainnya",
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Warranty claim state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimReason, setClaimReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  
  const [autoAffiliateLoading, setAutoAffiliateLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/order/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        setError("");
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Transaksi tidak ditemukan");
      }
    } catch {
      setError("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClaim = async () => {
    const reason = claimReason === "Lainnya" ? customReason : claimReason;
    if (!reason || reason.trim().length < 3) {
      setClaimError("Pilih atau tulis alasan klaim");
      return;
    }

    setClaimLoading(true);
    setClaimError("");
    try {
      const res = await fetch(`/api/order/${id}/warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setClaimSuccess(data.message);
        setShowClaimForm(false);
        setClaimReason("");
        setCustomReason("");
        fetchOrder(); // Refresh data
      } else {
        setClaimError(data.error || "Gagal mengirim klaim");
      }
    } catch {
      setClaimError("Gagal mengirim klaim");
    } finally {
      setClaimLoading(false);
    }
  };

  async function handleAutoAffiliate() {
    setAutoAffiliateLoading(true);
    try {
      const res = await fetch(`/api/order/${id}/affiliate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.redirect) window.location.href = data.redirect;
    } catch (e: any) {
      alert("Gagal mengaktifkan affiliate: " + e.message);
      setAutoAffiliateLoading(false);
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  // ─── LOADING ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: 60 }}>
          <RefreshCw size={32} color="#818cf8" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: "#94a3b8", marginTop: 16 }}>Memuat data transaksi...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── ERROR ──────────────────────────────────────────────
  if (error || !order) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: "center", padding: 60 }}>
          <AlertTriangle size={48} color="#fb7185" />
          <h2 style={{ color: "#f1f5f9", marginTop: 16, fontSize: 20 }}>
            {error || "Transaksi tidak ditemukan"}
          </h2>
          <p style={{ color: "#94a3b8", marginTop: 8, fontSize: 14 }}>
            Pastikan Transaction ID yang dimasukkan sudah benar
          </p>
          <Link
            href="/order"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              marginTop: 24, padding: "10px 20px",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "white", borderRadius: 10, textDecoration: "none",
              fontSize: 14, fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Kembali
          </Link>
        </div>
      </div>
    );
  }

  const hasPendingClaim = order.warrantyClaims.some(c => c.status === "pending" || c.status === "processing");

  // ─── ORDER DETAIL ───────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={styles.logo}>
            <ShieldCheck size={22} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", marginTop: 12, marginBottom: 4 }}>
            Detail Transaksi
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>
            {order.id}
          </p>
        </div>

        {/* Status Badge */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{
            ...styles.badge,
            background: order.status === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
            color: order.status === "success" ? "#34d399" : "#fbbf24",
          }}>
            {order.status === "success" ? <CheckCircle size={14} /> : <Clock size={14} />}
            {order.status === "success" ? "Pembayaran Berhasil" : order.status}
          </span>
        </div>

        {/* Product Info Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Package size={16} color="#818cf8" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#c4b5fd" }}>Produk</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Nama Produk</span>
            <span style={styles.value}>{order.productName || "-"}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Nominal</span>
            <span style={{ ...styles.value, color: "#34d399", fontWeight: 600 }}>
              {formatCurrency(Number(order.amount))}
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Tanggal Beli</span>
            <span style={styles.value}>
              <Calendar size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
              {formatDate(order.purchaseDate)}
            </span>
          </div>
        </div>

        {/* Account Card */}
        {order.account ? (
          <div style={{ ...styles.card, border: "1px solid rgba(16, 185, 129, 0.25)" }}>
            <div style={styles.cardHeader}>
              <Lock size={16} color="#34d399" />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#6ee7b7" }}>Akun Kamu {order.warrantyClaims.some(c => c.status === "resolved") && "(Terbaru)"}</span>
            </div>
            
            {order.warrantyClaims.filter(c => c.status === "resolved").map((claim) => claim.oldAccount ? (
              <div key={claim.id} style={{ marginBottom: 16 }}>
                <div style={{ ...styles.credentialRow, border: "1px dashed rgba(244,63,94,0.3)", borderBottom: "none", borderRadius: "12px 12px 0 0", background: "rgba(244,63,94,0.05)" }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#fb7185", display: "block", marginBottom: 2 }}>Email Lama (Diganti)</span>
                    <span style={{ fontSize: 14, color: "#fb7185", textDecoration: "line-through", opacity: 0.8 }}>{claim.oldAccount.email}</span>
                  </div>
                </div>
                <div style={{ ...styles.credentialRow, border: "1px dashed rgba(244,63,94,0.3)", borderRadius: "0 0 12px 12px", background: "rgba(244,63,94,0.05)" }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#fb7185", display: "block", marginBottom: 2 }}>Password Lama</span>
                    <span style={{ fontSize: 14, color: "#fb7185", fontFamily: "monospace", textDecoration: "line-through", opacity: 0.8 }}>
                      {claim.oldAccount.password}
                    </span>
                  </div>
                </div>
              </div>
            ) : null)}

            <div style={styles.credentialRow}>
              <div>
                <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Email</span>
                <span style={{ fontSize: 14, color: "#f1f5f9" }}>{order.account.email}</span>
              </div>
              <button
                onClick={() => copyToClipboard(order.account!.email, "email")}
                style={styles.copyBtn}
              >
                {copied === "email" ? <CheckCircle size={14} color="#34d399" /> : <Copy size={14} />}
              </button>
            </div>
            <div style={styles.credentialRow}>
              <div>
                <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Password</span>
                <span style={{ fontSize: 14, color: "#f1f5f9", fontFamily: "monospace" }}>
                  {order.account.password}
                </span>
              </div>
              <button
                onClick={() => copyToClipboard(order.account!.password, "password")}
                style={styles.copyBtn}
              >
                {copied === "password" ? <CheckCircle size={14} color="#34d399" /> : <Copy size={14} />}
              </button>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Tipe</span>
              <span style={styles.value}>{order.account.type}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Durasi</span>
              <span style={styles.value}>{order.account.duration} hari</span>
            </div>
          </div>
        ) : (
          <div style={{ ...styles.card, textAlign: "center", padding: 32 }}>
            <Clock size={32} color="#fbbf24" />
            <p style={{ color: "#fbbf24", marginTop: 12, fontSize: 14, fontWeight: 600 }}>
              Akun sedang diproses
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
              Admin akan segera mengirimkan akun kamu
            </p>
          </div>
        )}

        {/* Warranty Section */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Shield size={16} color={order.warrantyActive ? "#34d399" : "#fb7185"} />
            <span style={{
              fontSize: 14, fontWeight: 600,
              color: order.warrantyActive ? "#6ee7b7" : "#fca5a5",
            }}>
              Garansi
            </span>
            <span style={{
              marginLeft: "auto", fontSize: 12, padding: "2px 10px",
              borderRadius: 20,
              background: order.warrantyActive ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)",
              color: order.warrantyActive ? "#34d399" : "#fb7185",
            }}>
              {order.warrantyActive ? "Aktif" : "Expired"}
            </span>
          </div>

          {order.warrantyExpiredAt && (
            <div style={styles.row}>
              <span style={styles.label}>Berlaku hingga</span>
              <span style={styles.value}>{formatDate(order.warrantyExpiredAt)}</span>
            </div>
          )}

          {/* Claim Button */}
          {order.warrantyActive && !hasPendingClaim && (
            <button
              onClick={() => { setShowClaimForm(!showClaimForm); setClaimSuccess(""); }}
              style={{
                width: "100%", padding: "12px", marginTop: 12,
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.25)",
                borderRadius: 10, color: "#fb7185", fontSize: 14,
                fontWeight: 600, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <AlertTriangle size={16} />
              Klaim Garansi
              {showClaimForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}

          {hasPendingClaim && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 10,
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.2)",
              textAlign: "center",
            }}>
              <Clock size={16} color="#fbbf24" />
              <p style={{ color: "#fbbf24", fontSize: 13, marginTop: 6, fontWeight: 500 }}>
                Klaim garansi sedang diproses admin...
              </p>
            </div>
          )}

          {claimSuccess && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 10,
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              textAlign: "center",
            }}>
              <CheckCircle size={16} color="#34d399" />
              <p style={{ color: "#34d399", fontSize: 13, marginTop: 6 }}>{claimSuccess}</p>
            </div>
          )}

          {/* Claim Form */}
          {showClaimForm && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>
                Pilih alasan klaim:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {CLAIM_REASONS.map((r) => (
                  <label
                    key={r}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      background: claimReason === r ? "rgba(99, 102, 241, 0.12)" : "rgba(30, 41, 59, 0.5)",
                      border: `1px solid ${claimReason === r ? "rgba(99, 102, 241, 0.4)" : "rgba(99, 102, 241, 0.1)"}`,
                      transition: "all 0.2s",
                    }}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={claimReason === r}
                      onChange={(e) => { setClaimReason(e.target.value); setClaimError(""); }}
                      style={{ accentColor: "#6366f1" }}
                    />
                    <span style={{ fontSize: 13, color: "#e2e8f0" }}>{r}</span>
                  </label>
                ))}
              </div>

              {claimReason === "Lainnya" && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Jelaskan masalah yang kamu alami..."
                  style={{
                    width: "100%", marginTop: 10, padding: "10px 14px",
                    background: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: 10, color: "#f1f5f9", fontSize: 13,
                    resize: "vertical", minHeight: 80, outline: "none",
                    fontFamily: "'Inter', sans-serif",
                  }}
                />
              )}

              {claimError && (
                <p style={{ color: "#fb7185", fontSize: 12, marginTop: 8 }}>{claimError}</p>
              )}

              <button
                onClick={handleClaim}
                disabled={claimLoading}
                style={{
                  width: "100%", padding: "12px", marginTop: 12,
                  background: "linear-gradient(135deg, #e11d48, #f43f5e)",
                  border: "none", borderRadius: 10, color: "white",
                  fontSize: 14, fontWeight: 600, cursor: claimLoading ? "not-allowed" : "pointer",
                  opacity: claimLoading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {claimLoading ? "Mengirim..." : <>Kirim Klaim <ArrowRight size={16} /></>}
              </button>
            </div>
          )}
        </div>

        {/* Affiliate CTA Card */}
        <div style={{
          ...styles.card,
          background: "rgba(99, 102, 241, 0.1)",
          borderColor: "rgba(99, 102, 241, 0.3)",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          padding: "24px 20px"
        }}>
          <div style={{
            background: "rgba(99, 102, 241, 0.2)",
            padding: "8px 16px", borderRadius: 20,
            fontSize: 12, fontWeight: 700, color: "#a5b4fc",
            marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6
          }}>
            <Sparkles size={14} /> PROGRAM AFFILIATE
          </div>
          
          <h3 style={{ fontSize: 18, color: "white", fontWeight: 700, marginBottom: 8 }}>
            Cuan Tambahan? Dapatkan Komisi 20%!
          </h3>
          
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 20 }}>
            Bagikan link Dorizz Store ke temanmu. Nikmati <b>komisi bersih 20% langsung ke rekeningmu</b> setiap kali ada yang membeli melalui linkmu. <b>Berlaku untuk SEMUA produk!</b>
          </p>

          <button
            onClick={handleAutoAffiliate}
            disabled={autoAffiliateLoading}
            style={{
              width: "100%", padding: "14px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 14, fontWeight: 700,
              cursor: autoAffiliateLoading ? "not-allowed" : "pointer",
              opacity: autoAffiliateLoading ? 0.8 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: "'Inter', sans-serif",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)",
              transition: "transform 0.2s"
            }}
          >
            {autoAffiliateLoading ? "Mengaktifkan Akun..." : "🚀 Jadi Affiliator Sekarang - Gratis!"}
          </button>
        </div>

        {/* Warranty History */}
        {order.warrantyClaims.length > 0 && (
          <div style={styles.card}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", cursor: "pointer",
                color: "#c4b5fd", fontSize: 14, fontWeight: 600, padding: 0,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Clock size={16} />
              Riwayat Garansi ({order.warrantyClaims.length})
              <span style={{ marginLeft: "auto" }}>
                {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {showHistory && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {order.warrantyClaims.map((claim, i) => (
                  <div
                    key={claim.id}
                    style={{
                      padding: 14, borderRadius: 10,
                      background: "rgba(30, 41, 59, 0.5)",
                      border: "1px solid rgba(99, 102, 241, 0.1)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        #{order.warrantyClaims.length - i} · {formatDate(claim.createdAt)}
                      </span>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 12,
                        background: claim.status === "resolved"
                          ? "rgba(16,185,129,0.15)"
                          : claim.status === "pending"
                            ? "rgba(245,158,11,0.15)"
                            : "rgba(99,102,241,0.15)",
                        color: claim.status === "resolved"
                          ? "#34d399"
                          : claim.status === "pending"
                            ? "#fbbf24"
                            : "#818cf8",
                        fontWeight: 600,
                      }}>
                        {claim.status === "resolved" ? "✅ Selesai" : claim.status === "pending" ? "⏳ Menunggu" : claim.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 10 }}>
                      Alasan: {claim.reason}
                    </p>

                    {/* Before / After */}
                    {claim.status === "resolved" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{
                          padding: 10, borderRadius: 8,
                          background: "rgba(244, 63, 94, 0.08)",
                          border: "1px solid rgba(244, 63, 94, 0.15)",
                        }}>
                          <span style={{ fontSize: 10, color: "#fb7185", display: "block", marginBottom: 4, fontWeight: 600 }}>
                            BEFORE
                          </span>
                          <span style={{ fontSize: 12, color: "#fca5a5" }}>
                            <Mail size={10} /> {claim.oldAccount?.email || "-"}
                          </span>
                        </div>
                        <div style={{
                          padding: 10, borderRadius: 8,
                          background: "rgba(16, 185, 129, 0.08)",
                          border: "1px solid rgba(16, 185, 129, 0.15)",
                        }}>
                          <span style={{ fontSize: 10, color: "#34d399", display: "block", marginBottom: 4, fontWeight: 600 }}>
                            AFTER
                          </span>
                          <span style={{ fontSize: 12, color: "#6ee7b7" }}>
                            <Mail size={10} /> {claim.newAccount?.email || "-"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link
            href="/order"
            style={{ color: "#818cf8", fontSize: 13, textDecoration: "none" }}
          >
            ← Cari transaksi lain
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0f172a 100%)",
    padding: "24px 16px",
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    justifyContent: "center",
  },
  content: {
    maxWidth: 480,
    width: "100%",
    paddingTop: 32,
    paddingBottom: 48,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 16px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
  },
  card: {
    background: "rgba(26, 32, 53, 0.7)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(99, 102, 241, 0.15)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1px solid rgba(99, 102, 241, 0.1)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
  },
  label: {
    fontSize: 13,
    color: "#94a3b8",
  },
  value: {
    fontSize: 13,
    color: "#f1f5f9",
    fontWeight: 500,
    textAlign: "right" as const,
  },
  credentialRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    marginBottom: 8,
    borderRadius: 10,
    background: "rgba(16, 185, 129, 0.06)",
    border: "1px solid rgba(16, 185, 129, 0.1)",
  },
  copyBtn: {
    padding: 8,
    background: "rgba(30, 41, 59, 0.8)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    borderRadius: 8,
    color: "#94a3b8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
};
