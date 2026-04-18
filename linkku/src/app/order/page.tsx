"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, ArrowRight } from "lucide-react";

export default function OrderSearchPage() {
  const [transactionId, setTransactionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = transactionId.trim();
    if (!trimmed) {
      setError("Masukkan Transaction ID");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/order/${trimmed}`);
      if (res.ok) {
        router.push(`/order/${trimmed}`);
      } else {
        setError("Transaksi tidak ditemukan. Pastikan ID yang dimasukkan benar.");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        {/* Logo / Brand */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={26} color="white" />
          </div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              background: "linear-gradient(135deg, #818cf8, #c084fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Dorizz Store
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#f1f5f9",
            marginBottom: 8,
          }}
        >
          Cek Transaksi
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 15, marginBottom: 32 }}>
          Masukkan Transaction ID untuk melihat detail pesanan dan akun kamu
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch}>
          <div
            style={{
              position: "relative",
              marginBottom: 16,
            }}
          >
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
              }}
            />
            <input
              type="text"
              value={transactionId}
              onChange={(e) => {
                setTransactionId(e.target.value);
                setError("");
              }}
              placeholder="Masukkan Transaction ID..."
              style={{
                width: "100%",
                padding: "14px 16px 14px 46px",
                background: "rgba(26, 32, 53, 0.8)",
                border: `1px solid ${error ? "rgba(244, 63, 94, 0.5)" : "rgba(99, 102, 241, 0.2)"}`,
                borderRadius: 14,
                color: "#f1f5f9",
                fontSize: 15,
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.2)";
              }}
            />
          </div>

          {error && (
            <p
              style={{
                color: "#fb7185",
                fontSize: 13,
                marginBottom: 16,
                textAlign: "left",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 20px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)",
              color: "white",
              border: "none",
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: loading ? 0.7 : 1,
              transition: "all 0.3s",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {loading ? (
              "Mencari..."
            ) : (
              <>
                Cari Transaksi <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Info */}
        <div
          style={{
            marginTop: 40,
            padding: "16px 20px",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.15)",
            borderRadius: 12,
            textAlign: "left",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "#94a3b8",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            💡 <strong style={{ color: "#c4b5fd" }}>Transaction ID</strong> diberikan
            saat kamu menyelesaikan pembayaran. Simpan ID ini untuk mengakses akun
            dan klaim garansi kapan saja.
          </p>
        </div>
      </div>
    </div>
  );
}
