"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, UserPlus, Eye, EyeOff, Shield, AlertTriangle, CheckCircle } from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Check if this is first-ever registration (no developer exists)
  useEffect(() => {
    // If no token, check if it's the first registration
    if (!inviteToken) {
      fetch("/api/auth/me").then(r => {
        if (r.status === 200) {
          router.push("/"); // Already logged in
        }
      });
      // Allow registration without token only if developer doesn't exist
      setTokenValid(true); // Will validate on submit
    } else {
      setTokenValid(true); // Token will be validated on submit
    }
  }, [inviteToken, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Password dan konfirmasi password tidak cocok");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteToken }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Registrasi gagal");
        return;
      }
      setSuccess(json.message || "Registrasi berhasil!");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // If no invite token and NOT first registration
  if (tokenValid === false) {
    return (
      <div className="text-center">
        <AlertTriangle size={48} className="text-rose-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Akses Ditolak</h2>
        <p className="text-sm text-[rgba(255,255,255,0.4)]">Halaman ini membutuhkan invite link yang valid dari Developer.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Invite token info */}
      {inviteToken && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
          <span className="text-emerald-300">Invite link valid — daftar sebagai Admin</span>
        </div>
      )}
      {!inviteToken && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <Shield size={13} className="text-[#818cf8] flex-shrink-0" />
          <span className="text-[#a5b4fc]">Registrasi pertama → Akun Developer (Full Access)</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Nama Lengkap</label>
        <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required className="form-input w-full" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Email</label>
        <input type="email" placeholder="admin@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="form-input w-full" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Password</label>
        <div className="relative">
          <input type={showPass ? "text" : "password"} placeholder="Min. 8 karakter" value={password} onChange={e => setPassword(e.target.value)} required className="form-input w-full pr-10" />
          <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)] hover:text-white transition-colors">
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-1.5 uppercase tracking-wider">Konfirmasi Password</label>
        <input type={showPass ? "text" : "password"} placeholder="Ulangi password" value={confirm} onChange={e => setConfirm(e.target.value)} required className="form-input w-full" />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl text-sm text-rose-300" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-xl text-sm text-emerald-300" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)", opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer" }}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
        {loading ? "Mendaftar..." : "Daftar"}
      </button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0a0b14 0%, #0f1122 50%, #0d0e1a 100%)" }}
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 32px rgba(99,102,241,0.4)" }}>
            <UserPlus size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Buat Akun</h1>
          <p className="text-sm text-[rgba(255,255,255,0.4)] mt-1">CapCut Pro Dashboard</p>
        </div>

        <div className="rounded-2xl p-6 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#818cf8]" /></div>}>
            <RegisterForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-[rgba(255,255,255,0.2)] mt-6">
          Sudah punya akun? <a href="/login" className="text-[#818cf8] hover:underline">Masuk</a>
        </p>
      </div>
    </div>
  );
}
