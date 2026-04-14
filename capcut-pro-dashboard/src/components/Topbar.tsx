"use client";

import { ReactNode, useState, useRef, useEffect, useCallback } from "react";
import {
  Bell, Eye, EyeOff, Menu, LogOut, Shield, User, ChevronDown,
  CheckCircle2, Circle, ClipboardList, ExternalLink, Loader2,
} from "lucide-react";
import { usePrivacy } from "@/context/PrivacyContext";
import { useMobileNav } from "@/context/MobileNavContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface TopbarProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

interface TaskAssignment {
  id: string;
  status: string;
  date: string;
  task: {
    id: string;
    title: string;
    description: string | null;
    recurrenceType: string;
  };
}

export default function Topbar({ title, subtitle, children }: TopbarProps) {
  const { isPrivate, toggle } = usePrivacy();
  const { open } = useMobileNav();
  const { user, logout, isDeveloper } = useAuth();
  const router = useRouter();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showUserMenu]);

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!showBell) return;
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBell(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBell]);

  // Fetch tugas hari ini
  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch("/api/tasks/mine");
      if (!res.ok) return;
      const json = await res.json();
      setTasks(json.assignments || []);
      setPendingCount(json.pending || 0);
    } catch {
      // silent
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  // Load on mount + polling setiap 60 detik
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 60_000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  function handleBellClick() {
    setShowBell((v) => !v);
    if (!showBell) fetchTasks(); // refresh saat dibuka
  }

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "Asia/Jakarta",
  });

  return (
    <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button onClick={open} className="lg:hidden btn-icon flex-shrink-0" aria-label="Buka menu">
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <h2 className="text-base md:text-xl font-bold text-white leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5 hidden sm:block">{subtitle}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 ml-1 flex-shrink-0">{children}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Privacy Toggle */}
        <button
          onClick={toggle}
          className={`btn-icon relative transition-colors ${isPrivate ? "text-amber-400" : "text-[var(--text-muted)]"}`}
          title={isPrivate ? "Mode Privasi Aktif" : "Sembunyikan data sensitif"}
        >
          {isPrivate ? <EyeOff size={18} /> : <Eye size={18} />}
          {isPrivate && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />}
        </button>

        {/* ── Bell / Task Notification ── */}
        <div className="relative" ref={bellRef}>
          <button
            id="topbar-bell-btn"
            className="btn-icon relative"
            onClick={handleBellClick}
            title="Daftar Tugas Hari Ini"
          >
            <Bell size={18} />
            {pendingCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: "var(--gradient-danger)" }}
              >
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showBell && (
            <div
              id="topbar-bell-dropdown"
              className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden shadow-2xl z-50"
              style={{
                width: 320,
                background: "rgba(13,15,28,0.98)",
                border: "1px solid rgba(129,140,248,0.15)",
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Header */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(129,140,248,0.1)" }}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList size={15} className="text-[#818cf8]" />
                  <p className="text-sm font-bold text-white">Tugas Hari Ini</p>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] capitalize">{today}</p>
              </div>

              {/* Task List */}
              <div className="max-h-[340px] overflow-y-auto">
                {loadingTasks ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 size={16} className="animate-spin text-[#818cf8]" />
                    <span className="text-sm text-[var(--text-muted)]">Memuat tugas...</span>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(129,140,248,0.1)" }}
                    >
                      <ClipboardList size={18} className="text-[#818cf8]" />
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">Tidak ada tugas hari ini</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {tasks.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/3"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {a.status === "done" ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <Circle size={16} className="text-[var(--text-muted)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              a.status === "done"
                                ? "line-through text-[var(--text-muted)]"
                                : "text-white"
                            }`}
                          >
                            {a.task.title}
                          </p>
                          {a.task.description && (
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                              {a.task.description}
                            </p>
                          )}
                        </div>
                        <span
                          className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={
                            a.status === "done"
                              ? { background: "rgba(34,197,94,0.12)", color: "#4ade80" }
                              : { background: "rgba(251,191,36,0.12)", color: "#fbbf24" }
                          }
                        >
                          {a.status === "done" ? "Selesai" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer — link ke halaman absensi & tugas */}
              <div style={{ borderTop: "1px solid rgba(129,140,248,0.1)" }}>
                <button
                  onClick={() => {
                    setShowBell(false);
                    router.push("/absensi");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-[#818cf8] hover:bg-white/5 transition-colors"
                >
                  <ExternalLink size={13} />
                  Lihat Semua Tugas &amp; Absensi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu((p) => !p)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all hover:bg-white/5"
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: isDeveloper ? "linear-gradient(135deg,#f59e0b,#f97316)" : "var(--gradient-primary)" }}
            >
              {initials}
            </div>
            {/* Name + role — md+ only */}
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.name || "..."}</p>
              <div className="flex items-center gap-1">
                {isDeveloper
                  ? <><Shield size={9} className="text-amber-400" /><span className="text-[10px] text-amber-400 font-medium">Developer</span></>
                  : <><User size={9} className="text-[#818cf8]" /><span className="text-[10px] text-[#818cf8] font-medium">Admin</span></>
                }
              </div>
            </div>
            <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform hidden md:block ${showUserMenu ? "rotate-180" : ""}`} />
          </button>

          {/* User Dropdown */}
          {showUserMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden shadow-2xl z-50"
              style={{ background: "rgba(15,17,30,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(16px)" }}
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  {isDeveloper
                    ? <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5"><Shield size={9} /> Developer</span>
                    : <span className="text-[10px] font-bold text-[#818cf8] flex items-center gap-0.5"><User size={9} /> Admin</span>
                  }
                </div>
              </div>
              {/* Logout */}
              <button
                onClick={() => { setShowUserMenu(false); logout(); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
              >
                <LogOut size={15} />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
