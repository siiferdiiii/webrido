"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Eye, EyeOff, ShoppingBag } from "lucide-react";

export default function AffiliateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate-portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Login gagal");
        return;
      }
      router.push("/affiliate");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0a0b14 0%, #0f1122 50%, #0d0e1a 100%)" }}
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #059669, transparent)" }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 8px 32px rgba(16,185,129,0.4)" }}
          >
            <ShoppingBag size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Affiliate Portal</h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)] mt-1">Masuk ke portal affiliate Dorizz Store</p>
        </div>

        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                placeholder="affiliate@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="form-input w-full"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="form-input w-full pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-xl text-sm text-rose-300" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? "Masuk..." : "Masuk"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[rgba(255,255,255,0.2)] mt-6">
          Belum punya akun? Hubungi admin untuk mendapatkan invite link.
        </p>
      </div>
    </div>
  );
}
