"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, ShoppingBag, CheckCircle, AlertTriangle, KeyRound } from "lucide-react";

function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [affiliateName, setAffiliateName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }

    fetch(`/api/affiliate-portal/auth/setup?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setTokenValid(true);
          setAffiliateName(data.affiliate?.name || "");
        } else {
          setError(data.error || "Token tidak valid");
        }
      })
      .catch(() => setError("Gagal memvalidasi token"))
      .finally(() => setValidating(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Password dan konfirmasi tidak cocok");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/affiliate-portal/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal mengatur password");
        return;
      }
      setSuccess("Password berhasil diatur! Mengalihkan...");
      setTimeout(() => router.push("/affiliate"), 1500);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center py-8">
        <AlertTriangle size={48} className="text-rose-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Token Diperlukan</h2>
        <p className="text-sm text-[rgba(255,255,255,0.4)]">
          Gunakan invite link yang diberikan oleh admin.
        </p>
      </div>
    );
  }

  if (!tokenValid && error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle size={48} className="text-rose-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Invite Link Tidak Valid</h2>
        <p className="text-sm text-[rgba(255,255,255,0.4)]">{error}</p>
        <a
          href="/affiliate/login"
          className="inline-block mt-4 text-sm text-emerald-400 hover:underline"
        >
          Sudah punya akun? Login di sini
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
        <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
        <span className="text-emerald-300">Selamat datang, <strong>{affiliateName}</strong>! Atur password Anda.</span>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Password Baru</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            placeholder="Min. 8 karakter"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="form-input w-full pr-10"
          />
          <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Konfirmasi Password</label>
        <input
          type={showPass ? "text" : "password"}
          placeholder="Ulangi password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          className="form-input w-full"
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl text-sm text-rose-300" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-xl text-sm text-emerald-300" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
          {success}
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
        {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
        {loading ? "Menyimpan..." : "Atur Password"}
      </button>
    </form>
  );
}

export default function AffiliateSetupPage() {
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
          <h1 className="text-2xl font-bold text-white">Aktivasi Akun</h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)] mt-1">Atur password untuk akses portal affiliate</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-emerald-400" /></div>}>
            <SetupForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-[rgba(255,255,255,0.2)] mt-6">
          Sudah punya akun? <a href="/affiliate/login" className="text-emerald-400 hover:underline">Masuk di sini</a>
        </p>
      </div>
    </div>
  );
}
