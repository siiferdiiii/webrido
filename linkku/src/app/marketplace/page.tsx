"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Smartphone,
  Monitor,
  Check,
  ShoppingCart,
  Loader2,
  Star,
  Shield,
  Zap,
  Sparkles,
  ArrowRight,
  Search,
  X,
  Package,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  type: string;
  features: string[];
  popular: boolean;
  stock?: { accounts: number; slots: number };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "" });
  const [error, setError] = useState("");
  const [checkOrderId, setCheckOrderId] = useState("");

  useEffect(() => {
    // Preserve affiliate ID automatically
    const affParams = searchParams.get("aff");
    if (affParams) {
      localStorage.setItem("affiliate_id", affParams);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckout() {
    if (!selectedProduct || !form.name || !form.email || !form.whatsapp) {
      setError("Semua field wajib diisi");
      return;
    }
    setError("");
    setCheckoutLoading(true);

    try {
      const storedAffId = localStorage.getItem("affiliate_id");
      
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          whatsapp: form.whatsapp,
          productName: selectedProduct.name,
          amount: selectedProduct.price,
          productType: selectedProduct.type,
          affiliateId: storedAffId || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Gagal membuat pembayaran");
        setCheckoutLoading(false);
        return;
      }

      // Redirect to Midtrans payment page
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl;
      }
    } catch {
      setError("Koneksi error, coba lagi");
    }
    setCheckoutLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0b14 0%, #0f1029 50%, #0a0b14 100%)",
        color: "white",
      }}
    >
      {/* ── Hero Section ── */}
      <header
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "60px 20px 40px",
          textAlign: "center",
        }}
      >
        {/* Glow effects */}
        <div
          style={{
            position: "absolute",
            top: "-40%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "400px",
            background: "radial-gradient(ellipse, rgba(99,102,241,0.15), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "-20%",
            right: "10%",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
          {/* Logo/Brand */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 20px",
              borderRadius: 100,
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)",
              marginBottom: 24,
            }}
          >
            <Sparkles size={16} style={{ color: "#818cf8" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#a5b4fc" }}>
              Dorizz Store — Official CapCut Pro Reseller
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 48px)",
              fontWeight: 800,
              lineHeight: 1.15,
              background: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 50%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 16,
            }}
          >
            CapCut Pro Premium
            <br />
            <span style={{ fontSize: "0.65em", fontWeight: 600 }}>Harga Terjangkau, Akses Penuh</span>
          </h1>

          <p
            style={{
              fontSize: "clamp(14px, 2vw, 16px)",
              color: "rgba(255,255,255,0.55)",
              maxWidth: 540,
              margin: "0 auto 32px",
              lineHeight: 1.6,
            }}
          >
            Nikmati semua fitur premium CapCut Pro — filter eksklusif, export tanpa watermark, AI tools, dan cloud
            storage. Aktivasi instan, garansi penuh.
          </p>

          {/* Trust badges */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            {[
              { icon: Zap, label: "Aktivasi Instan" },
              { icon: Shield, label: "Garansi Full" },
              { icon: Star, label: "1000+ Customer" },
            ].map((badge) => (
              <div
                key={badge.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                <badge.icon size={14} style={{ color: "#818cf8" }} />
                {badge.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Check Order Section ── */}
      <section style={{ maxWidth: 480, margin: "0 auto 48px", padding: "0 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Search size={16} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Cek pesanan — masukkan ID Transaksi..."
            value={checkOrderId}
            onChange={(e) => setCheckOrderId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && checkOrderId.trim()) {
                window.location.href = `/order/${checkOrderId.trim()}`;
              }
            }}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "white",
              fontSize: 14,
            }}
          />
          {checkOrderId && (
            <button
              onClick={() => {
                window.location.href = `/order/${checkOrderId.trim()}`;
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: "rgba(99,102,241,0.2)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Cek <ArrowRight size={12} />
            </button>
          )}
        </div>
      </section>

      {/* ── Products Grid ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 80px" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Pilih Paket
        </h2>
        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 32,
          }}
        >
          Sharing akun premium — harga bersahabat, kualitas terjamin
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Loader2 size={32} style={{ color: "#818cf8" }} className="animate-spin" />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {products.map((product) => {
              const isSelected = selectedProduct?.id === product.id;
              const isMobile = product.type === "mobile";
              const stockSlots = product.stock?.slots ?? 0;
              const isOutOfStock = stockSlots <= 0;

              return (
                <div
                  key={product.id}
                  onClick={() => {
                    if (!isOutOfStock) {
                      setSelectedProduct(product);
                      setShowCheckout(true);
                    }
                  }}
                  style={{
                    position: "relative",
                    borderRadius: 20,
                    padding: "28px 24px",
                    cursor: isOutOfStock ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    opacity: isOutOfStock ? 0.5 : 1,
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))"
                      : "rgba(255,255,255,0.025)",
                    border: `1px solid ${
                      isSelected ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.06)"
                    }`,
                    boxShadow: isSelected ? "0 8px 40px rgba(99,102,241,0.15)" : "none",
                    transform: isSelected ? "translateY(-2px)" : "none",
                  }}
                >
                  {/* Popular badge */}
                  {product.popular && (
                    <div
                      style={{
                        position: "absolute",
                        top: -10,
                        right: 16,
                        padding: "4px 12px",
                        borderRadius: 100,
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "white",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
                      }}
                    >
                      Best Seller
                    </div>
                  )}

                  {/* SKU Badge */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: "monospace",
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: 12,
                      letterSpacing: "0.5px",
                    }}
                  >
                    SKU: {product.id}
                  </div>

                  {/* Icon + Stock */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isMobile ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                        border: `1px solid ${isMobile ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)"}`,
                      }}
                    >
                      {isMobile ? (
                        <Smartphone size={20} style={{ color: "#22c55e" }} />
                      ) : (
                        <Monitor size={20} style={{ color: "#3b82f6" }} />
                      )}
                    </div>

                    {/* Stock indicator */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: isOutOfStock
                          ? "rgba(239,68,68,0.1)"
                          : stockSlots <= 3
                          ? "rgba(251,191,36,0.1)"
                          : "rgba(34,197,94,0.08)",
                        border: `1px solid ${isOutOfStock
                          ? "rgba(239,68,68,0.25)"
                          : stockSlots <= 3
                          ? "rgba(251,191,36,0.25)"
                          : "rgba(34,197,94,0.2)"}`,
                      }}
                    >
                      <Package size={11} style={{ color: isOutOfStock ? "#ef4444" : stockSlots <= 3 ? "#fbbf24" : "#22c55e" }} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isOutOfStock ? "#ef4444" : stockSlots <= 3 ? "#fbbf24" : "#22c55e",
                        }}
                      >
                        {isOutOfStock ? "Habis" : `${stockSlots} slot`}
                      </span>
                    </div>
                  </div>

                  {/* Name */}
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{product.name}</h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.5 }}>
                    {product.description}
                  </p>

                  {/* Price */}
                  <div style={{ marginBottom: 20 }}>
                    <span
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        background: "linear-gradient(135deg, #ffffff, #a5b4fc)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {formatCurrency(product.price)}
                    </span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>
                      / {product.duration} hari
                    </span>
                  </div>

                  {/* Features */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {product.features.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    disabled={isOutOfStock}
                    style={{
                      width: "100%",
                      padding: "12px 0",
                      borderRadius: 12,
                      border: "none",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isOutOfStock ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.2s",
                      background: isOutOfStock
                        ? "rgba(255,255,255,0.03)"
                        : product.popular
                        ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                        : "rgba(255,255,255,0.06)",
                      color: isOutOfStock ? "rgba(255,255,255,0.3)" : product.popular ? "white" : "rgba(255,255,255,0.7)",
                      boxShadow: product.popular && !isOutOfStock ? "0 4px 20px rgba(99,102,241,0.3)" : "none",
                    }}
                  >
                    {isOutOfStock ? (
                      <>Stok Habis</>  
                    ) : (
                      <><ShoppingCart size={15} /> Beli Sekarang</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          textAlign: "center",
          padding: "32px 20px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.3)",
          fontSize: 12,
        }}
      >
        <p>© 2026 Dorizz Store. All rights reserved.</p>
        <p style={{ marginTop: 4 }}>
          Pembayaran aman via{" "}
          <span style={{ color: "#818cf8", fontWeight: 600 }}>Midtrans</span>
        </p>
      </footer>

      {/* ── Checkout Modal ── */}
      {showCheckout && selectedProduct && (
        <div
          onClick={() => setShowCheckout(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              borderRadius: 24,
              background: "linear-gradient(180deg, #14152a, #0f1029)",
              border: "1px solid rgba(99,102,241,0.2)",
              overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(99,102,241,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Checkout</h3>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {selectedProduct.name} — {formatCurrency(selectedProduct.price)}
                </p>
              </div>
              <button
                onClick={() => setShowCheckout(false)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Masukkan nama kamu"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  No. WhatsApp
                </label>
                <input
                  type="text"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="08xxx atau 628xxx"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "#f87171", padding: "8px 12px", borderRadius: 8, background: "rgba(248,113,113,0.1)" }}>
                  {error}
                </p>
              )}

              {/* Order Summary */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.15)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Produk</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedProduct.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Durasi</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedProduct.duration} Hari</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: "1px solid rgba(99,102,241,0.15)",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#a5b4fc" }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "white" }}>
                    {formatCurrency(selectedProduct.price)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: checkoutLoading ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 6px 24px rgba(99,102,241,0.35)",
                  opacity: checkoutLoading ? 0.7 : 1,
                }}
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Memproses...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} /> Bayar Sekarang
                  </>
                )}
              </button>

              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
                Pembayaran akan diproses melalui Midtrans (QRIS, Transfer Bank, E-Wallet)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0b14" }}>
        <Loader2 size={32} style={{ color: "#6366f1", animation: "spin 1s linear infinite" }} />
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
