"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/context/AuthContext";
import {
  ClipboardList, Clock, CheckCircle2, Circle, Plus, Trash2, Pencil,
  Save, X, Loader2, Users, Calendar, ChevronRight,
  CalendarClock, Check, AlertCircle, Shield, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminUser { id: string; name: string; email: string; whatsapp: string | null; status: string; }
interface Task { id: string; title: string; description: string | null; recurrenceType: "daily" | "once"; scheduledDate: string | null; isActive: boolean; assignments: { adminId: string; admin: { name: string } }[]; }
interface TaskAssignment { id: string; taskId: string; adminId: string; date: string; status: "pending" | "done"; completedAt: string | null; task: { title: string; description: string | null }; }
interface Schedule { id?: string; adminId: string; shiftStart: string; shiftEnd: string; isActive: boolean; }
interface AttendanceRecord { id: string; adminId: string; date: string; checkInAt: string | null; checkOutAt: string | null; webhookSentIn: boolean; webhookSentOut: boolean; admin: { name: string; email: string; whatsapp: string | null }; }

const todayWIB = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "-";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AbsensiPage() {
  const { isDeveloper, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"jadwal" | "tugas" | "rekap">("tugas");

  // ── Shared state ──
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myAssignments, setMyAssignments] = useState<TaskAssignment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [loading, setLoading] = useState(true);
  const [rekapDate, setRekapDate] = useState(todayWIB());

  // ── Task form ──
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskRecurrence, setTaskRecurrence] = useState<"daily" | "once">("daily");
  const [taskDate, setTaskDate] = useState(todayWIB());
  const [savingTask, setSavingTask] = useState(false);

  // ── Schedule state ──
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ shiftStart: "08:00", shiftEnd: "17:00", isActive: true });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // ── Task assign ──
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [selectedAdmins, setSelectedAdmins] = useState<Record<string, boolean>>({});

  // ── Admin detail (Rekap tab) ──
  type AdminDetail = {
    admin: AdminUser & { role: string };
    schedule: Schedule | null;
    attendance: { checkInAt: string | null; checkOutAt: string | null; webhookSentIn: boolean; webhookSentOut: boolean } | null;
    assignments: (TaskAssignment & { task: { title: string; description: string | null; recurrenceType: string } })[]; 
    summary: { total: number; done: number; pending: number; completionPct: number };
  };
  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);
  const [adminDetailMap, setAdminDetailMap] = useState<Record<string, AdminDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  async function fetchAdminDetail(adminId: string) {
    if (loadingDetailId) return;
    if (expandedAdminId === adminId) { setExpandedAdminId(null); return; }
    setLoadingDetailId(adminId);
    try {
      const res = await fetch(`/api/admin/users/${adminId}/tasks?date=${rekapDate}`);
      const data = await res.json();
      setAdminDetailMap(prev => ({ ...prev, [adminId]: data }));
      setExpandedAdminId(adminId);
    } finally { setLoadingDetailId(null); }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isDeveloper) {
        const [adminsRes, tasksRes, attRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/tasks"),
          fetch(`/api/attendance?date=${rekapDate}`),
        ]);
        const adminsData = await adminsRes.json();
        const tasksData = await tasksRes.json();
        const attData = await attRes.json();
        const allAdmins: AdminUser[] = adminsData.users || [];
        setAdminUsers(allAdmins.filter(u => u.status === "active"));
        setTasks(tasksData.tasks || []);
        setAttendanceRecords(attData.records || []);

        // Load all schedules
        const scheds: Record<string, Schedule> = {};
        await Promise.all(allAdmins.filter(u => u.status === "active").map(async a => {
          const r = await fetch(`/api/admin/schedule/${a.id}`);
          const d = await r.json();
          if (d.schedule) scheds[a.id] = d.schedule;
        }));
        setSchedules(scheds);
      } else {
        // Admin view: load own tasks + attendance
        const date = todayWIB();
        const [tasksRes, attRes] = await Promise.all([
          fetch(`/api/task-assignments/my?date=${date}`),
          fetch(`/api/attendance?date=${date}`),
        ]);
        const tasksData = await tasksRes.json();
        const attData = await attRes.json();
        setMyAssignments(tasksData.assignments || []);
        setAttendanceRecords(attData.records || []);
      }
    } catch (e) {
      console.error("loadData error:", e);
    } finally {
      setLoading(false);
    }
  }, [isDeveloper, rekapDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save Task ──
  async function saveTask() {
    setSavingTask(true);
    try {
      const body = { title: taskTitle, description: taskDesc || null, recurrenceType: taskRecurrence, scheduledDate: taskRecurrence === "once" ? taskDate : null };
      const url = editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks";
      const method = editingTask ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setShowTaskForm(false); setEditingTask(null); setTaskTitle(""); setTaskDesc(""); loadData(); }
    } finally { setSavingTask(false); }
  }

  function openEditTask(t: Task) {
    setEditingTask(t); setTaskTitle(t.title); setTaskDesc(t.description || "");
    setTaskRecurrence(t.recurrenceType); setTaskDate(t.scheduledDate || todayWIB());
    setShowTaskForm(true);
  }

  async function deleteTask(id: string) {
    if (!confirm("Hapus tugas ini?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    loadData();
  }

  // ── Save Schedule ──
  async function saveSchedule(adminId: string) {
    setSavingSchedule(true);
    try {
      await fetch(`/api/admin/schedule/${adminId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleForm),
      });
      setEditScheduleId(null);
      loadData();
    } finally { setSavingSchedule(false); }
  }

  // ── Assign/unassign task ──
  function openAssign(task: Task) {
    const current: Record<string, boolean> = {};
    adminUsers.forEach(a => {
      current[a.id] = (task.assignments || []).some(as => as.adminId === a.id);
    });
    setSelectedAdmins(current);
    setAssigningTaskId(task.id);
  }

  async function saveAssign(taskId: string) {
    const toAssign = Object.entries(selectedAdmins).filter(([, v]) => v).map(([k]) => k);
    const toUnassign = Object.entries(selectedAdmins).filter(([, v]) => !v).map(([k]) => k);
    if (toAssign.length > 0) await fetch(`/api/tasks/${taskId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminIds: toAssign, action: "assign" }) });
    if (toUnassign.length > 0) await fetch(`/api/tasks/${taskId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminIds: toUnassign, action: "unassign" }) });
    setAssigningTaskId(null);
    loadData();
  }

  // ── Admin: toggle task done ──
  async function toggleTask(assignment: TaskAssignment) {
    const newStatus = assignment.status === "done" ? "pending" : "done";
    await fetch(`/api/task-assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setMyAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, status: newStatus, completedAt: newStatus === "done" ? new Date().toISOString() : null } : a));
  }

  // ─── UI ───────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Topbar title="Absensi & Tugas" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent-primary)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Absensi & Tugas" />
      <div className="flex-1 p-4 md:p-6 space-y-5 max-w-6xl mx-auto w-full">

        {/* ─── DEVELOPER VIEW ────────────────────────────────────────────────── */}
        {isDeveloper ? (
          <>
            {/* Tab bar */}
            <div className="flex gap-2 flex-wrap">
              {(["tugas", "jadwal", "rekap"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize"
                  style={{
                    background: activeTab === tab ? "var(--gradient-primary)" : "rgba(255,255,255,0.05)",
                    color: activeTab === tab ? "white" : "var(--text-muted)",
                    border: activeTab === tab ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {tab === "tugas" ? "📋 Tugas (RKHI)" : tab === "jadwal" ? "🕐 Jadwal Shift" : "📊 Rekap Absensi"}
                </button>
              ))}
              <button onClick={loadData} className="btn-icon ml-auto" title="Refresh"><RefreshCw size={15} /></button>
            </div>

            {/* ── TAB: TUGAS ── */}
            {activeTab === "tugas" && (
              <div className="space-y-4">
                {/* Header + Add button */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--text-muted)]">{tasks.length} tugas terdaftar</p>
                  <button onClick={() => { setEditingTask(null); setTaskTitle(""); setTaskDesc(""); setTaskRecurrence("daily"); setShowTaskForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                    style={{ background: "var(--gradient-primary)" }}>
                    <Plus size={14} /> Buat Tugas
                  </button>
                </div>

                {/* Task form */}
                {showTaskForm && (
                  <div className="glass-card p-4 space-y-3">
                    <p className="text-sm font-semibold text-white">{editingTask ? "Edit Tugas" : "Buat Tugas Baru"}</p>
                    <input className="form-input w-full text-sm" placeholder="Judul tugas..." value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                    <textarea className="form-input w-full text-sm resize-none" rows={2} placeholder="Deskripsi (opsional)..." value={taskDesc} onChange={e => setTaskDesc(e.target.value)} />
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex gap-2">
                        {(["daily", "once"] as const).map(r => (
                          <button key={r} onClick={() => setTaskRecurrence(r)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: taskRecurrence === r ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)", color: taskRecurrence === r ? "#818cf8" : "var(--text-muted)", border: `1px solid ${taskRecurrence === r ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                            {r === "daily" ? "🔄 Harian" : "📅 Sekali"}
                          </button>
                        ))}
                      </div>
                      {taskRecurrence === "once" && (
                        <input type="date" className="form-input text-xs" value={taskDate} onChange={e => setTaskDate(e.target.value)} />
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowTaskForm(false)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-white transition-colors"><X size={14} /></button>
                      <button onClick={saveTask} disabled={savingTask || !taskTitle.trim()}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "var(--gradient-primary)", opacity: !taskTitle.trim() ? 0.5 : 1 }}>
                        {savingTask ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {editingTask ? "Simpan" : "Buat"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Task list */}
                {tasks.length === 0 && !showTaskForm && (
                  <div className="glass-card p-10 text-center">
                    <ClipboardList size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-[var(--text-muted)]">Belum ada tugas. Buat tugas pertama!</p>
                  </div>
                )}
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div key={task.id} className="glass-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-semibold ${task.isActive ? "text-white" : "text-[var(--text-muted)] line-through"}`}>{task.title}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: task.recurrenceType === "daily" ? "rgba(99,102,241,0.15)" : "rgba(245,158,11,0.15)", color: task.recurrenceType === "daily" ? "#818cf8" : "#f59e0b" }}>
                              {task.recurrenceType === "daily" ? "🔄 Harian" : `📅 ${task.scheduledDate}`}
                            </span>
                            {!task.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold">Nonaktif</span>}
                          </div>
                          {task.description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{task.description}</p>}
                          {/* Assigned admins */}
                          {(task.assignments?.length || 0) > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {(task.assignments || []).slice(0, 4).map(a => (
                                <span key={a.adminId} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                                  {a.admin.name}
                                </span>
                              ))}
                              {(task.assignments?.length || 0) > 4 && <span className="text-[10px] text-[var(--text-muted)]">+{(task.assignments?.length || 0) - 4}</span>}
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openAssign(task)} className="btn-icon" title="Assign ke admin" style={{ color: "#22c55e" }}><Users size={14} /></button>
                          <button onClick={() => openEditTask(task)} className="btn-icon" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => deleteTask(task.id)} className="btn-icon hover:text-rose-400" title="Hapus"><Trash2 size={14} /></button>
                        </div>
                      </div>

                      {/* Assign panel */}
                      {assigningTaskId === task.id && (
                        <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <p className="text-xs font-semibold text-[var(--text-muted)]">Assign ke admin:</p>
                          {adminUsers.length === 0 && <p className="text-xs text-[var(--text-muted)]">Belum ada admin aktif.</p>}
                          {adminUsers.map(a => (
                            <label key={a.id} className="flex items-center gap-2.5 cursor-pointer">
                              <div onClick={() => setSelectedAdmins(p => ({ ...p, [a.id]: !p[a.id] }))}
                                className="w-8 h-4 rounded-full relative flex-shrink-0 cursor-pointer transition-all"
                                style={{ background: selectedAdmins[a.id] ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)", border: `1px solid ${selectedAdmins[a.id] ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.12)"}` }}>
                                <span className="absolute top-0.5 w-3 h-3 rounded-full transition-all" style={{ background: selectedAdmins[a.id] ? "#818cf8" : "rgba(255,255,255,0.25)", left: selectedAdmins[a.id] ? "calc(100% - 14px)" : "2px" }} />
                              </div>
                              <span className="text-xs text-white">{a.name}</span>
                            </label>
                          ))}
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => setAssigningTaskId(null)} className="text-xs text-[var(--text-muted)] hover:text-white"><X size={12} /></button>
                            <button onClick={() => saveAssign(task.id)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg text-white" style={{ background: "var(--gradient-primary)" }}>
                              <Check size={12} /> Simpan
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: JADWAL ── */}
            {activeTab === "jadwal" && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--text-muted)]">Atur jadwal shift check-in/check-out per admin. Webhook otomatis terkirim saat jam tiba (via n8n cron).</p>
                {adminUsers.length === 0 && (
                  <div className="glass-card p-10 text-center">
                    <Users size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-[var(--text-muted)]">Belum ada admin aktif.</p>
                  </div>
                )}
                {adminUsers.map(admin => {
                  const sched = schedules[admin.id];
                  const isEditing = editScheduleId === admin.id;
                  return (
                    <div key={admin.id} className="glass-card p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ background: "var(--gradient-primary)" }}>
                          {admin.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{admin.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{admin.whatsapp || admin.email}</p>
                        </div>
                        {sched && !isEditing && (
                          <div className="text-xs font-mono text-right mr-2">
                            <p className="text-white">{sched.shiftStart} – {sched.shiftEnd}</p>
                            <p className={sched.isActive ? "text-emerald-400" : "text-rose-400"}>{sched.isActive ? "Aktif" : "Nonaktif"}</p>
                          </div>
                        )}
                        <button onClick={() => {
                          if (isEditing) { setEditScheduleId(null); return; }
                          setScheduleForm(sched ? { shiftStart: sched.shiftStart, shiftEnd: sched.shiftEnd, isActive: sched.isActive } : { shiftStart: "08:00", shiftEnd: "17:00", isActive: true });
                          setEditScheduleId(admin.id);
                        }} className="btn-icon flex-shrink-0">
                          {isEditing ? <X size={14} /> : <Pencil size={14} />}
                        </button>
                      </div>
                      {isEditing && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Jam Masuk</label>
                            <input type="time" className="form-input w-full mt-1 text-sm font-mono" value={scheduleForm.shiftStart} onChange={e => setScheduleForm(p => ({ ...p, shiftStart: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Jam Keluar</label>
                            <input type="time" className="form-input w-full mt-1 text-sm font-mono" value={scheduleForm.shiftEnd} onChange={e => setScheduleForm(p => ({ ...p, shiftEnd: e.target.value }))} />
                          </div>
                          <div className="col-span-2 flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <div onClick={() => setScheduleForm(p => ({ ...p, isActive: !p.isActive }))}
                                className="w-10 h-5 rounded-full relative cursor-pointer transition-all"
                                style={{ background: scheduleForm.isActive ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)", border: `1px solid ${scheduleForm.isActive ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.12)"}` }}>
                                <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ background: scheduleForm.isActive ? "#22c55e" : "rgba(255,255,255,0.3)", left: scheduleForm.isActive ? "calc(100% - 18px)" : "2px" }} />
                              </div>
                              <span className="text-xs text-[var(--text-muted)]">{scheduleForm.isActive ? "Jadwal aktif" : "Nonaktif"}</span>
                            </label>
                            <button onClick={() => saveSchedule(admin.id)} disabled={savingSchedule}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
                              style={{ background: "var(--gradient-primary)" }}>
                              {savingSchedule ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Simpan
                            </button>
                          </div>
                        </div>
                      )}
                      {!sched && !isEditing && (
                        <p className="text-xs text-amber-400">⚠ Belum ada jadwal — klik edit untuk mengatur.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TAB: REKAP ── */}
            {activeTab === "rekap" && (
              <div className="space-y-4">
                {/* Date picker */}
                <div className="flex items-center gap-3 flex-wrap">
                  <input type="date" className="form-input text-sm" value={rekapDate} onChange={e => setRekapDate(e.target.value)} />
                  <button onClick={() => { setExpandedAdminId(null); setAdminDetailMap({}); loadData(); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                    style={{ background: "var(--gradient-primary)" }}>
                    <RefreshCw size={13} /> Tampilkan
                  </button>
                  <p className="text-xs text-[var(--text-muted)] ml-auto">{adminUsers.length} admin aktif</p>
                </div>

                {adminUsers.length === 0 && (
                  <div className="glass-card p-10 text-center">
                    <Users size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-[var(--text-muted)]">Belum ada admin aktif.</p>
                  </div>
                )}

                {/* Admin cards */}
                <div className="space-y-3">
                  {adminUsers.map(admin => {
                    const att = attendanceRecords.find(r => r.adminId === admin.id);
                    const sched = schedules[admin.id];
                    const detail = adminDetailMap[admin.id];
                    const isExpanded = expandedAdminId === admin.id;
                    const isLoadingThis = loadingDetailId === admin.id;
                    const pct = detail?.summary.completionPct ?? null;

                    return (
                      <div key={admin.id} className="glass-card overflow-hidden">
                        {/* ── Header row — clickable ── */}
                        <div
                          onClick={() => fetchAdminDetail(admin.id)}
                          className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-all select-none">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ background: "var(--gradient-primary)" }}>
                            {admin.name.slice(0, 2).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{admin.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">{admin.whatsapp || admin.email}</p>
                            {sched && (
                              <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                🕐 {sched.shiftStart} – {sched.shiftEnd}
                              </p>
                            )}
                          </div>

                          {/* Check-in/out badges */}
                          <div className="text-right text-xs space-y-1 mr-2">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-[var(--text-muted)]">In:</span>
                              <span className={att?.checkInAt ? "text-emerald-400 font-mono font-semibold" : "text-[var(--text-muted)]"}
                              >{att?.checkInAt ? fmtTime(att.checkInAt) : "–"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-[var(--text-muted)]">Out:</span>
                              <span className={att?.checkOutAt ? "text-indigo-400 font-mono font-semibold" : "text-[var(--text-muted)]"}
                              >{att?.checkOutAt ? fmtTime(att.checkOutAt) : "–"}</span>
                            </div>
                          </div>

                          {/* Expand chevron / loader */}
                          {isLoadingThis
                            ? <Loader2 size={16} className="animate-spin text-[var(--text-muted)] flex-shrink-0" />
                            : <ChevronRight size={16} className="flex-shrink-0 transition-transform text-[var(--text-muted)]" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
                          }
                        </div>

                        {/* ── Expanded detail panel ── */}
                        {isExpanded && detail && (
                          <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            {/* Summary stats */}
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: "Total", val: detail.summary.total, color: "text-white" },
                                { label: "Selesai", val: detail.summary.done, color: "text-emerald-400" },
                                { label: "Pending", val: detail.summary.pending, color: "text-amber-400" },
                              ].map(s => (
                                <div key={s.label} className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                                  <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                                  <p className="text-[10px] text-[var(--text-muted)] uppercase">{s.label}</p>
                                </div>
                              ))}
                            </div>

                            {/* Progress bar */}
                            {detail.summary.total > 0 && (
                              <div>
                                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                                  <span>Progress</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                  <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: pct === 100 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "var(--gradient-primary)" }} />
                                </div>
                              </div>
                            )}

                            {/* Task list */}
                            {detail.assignments.length === 0 ? (
                              <p className="text-xs text-[var(--text-muted)] text-center py-2">Tidak ada tugas untuk tanggal ini.</p>
                            ) : (
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Daftar Tugas</p>
                                {detail.assignments.map(a => (
                                  <div key={a.id} className="flex items-start gap-2.5 p-2.5 rounded-xl"
                                    style={{ background: a.status === "done" ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${a.status === "done" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}` }}>
                                    <div className="flex-shrink-0 mt-0.5">
                                      {a.status === "done"
                                        ? <CheckCircle2 size={15} className="text-emerald-400" />
                                        : <Circle size={15} className="text-[var(--text-muted)]" />
                                      }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-medium ${a.status === "done" ? "line-through text-[var(--text-muted)]" : "text-white"}`}>
                                        {a.task.title}
                                      </p>
                                      {a.task.description && (
                                        <p className="text-[10px] text-[var(--text-muted)]">{a.task.description}</p>
                                      )}
                                      {a.completedAt && (
                                        <p className="text-[10px] text-emerald-400">✓ {fmtTime(a.completedAt)}</p>
                                      )}
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                      a.status === "done" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                    }`}>{a.status === "done" ? "Selesai" : "Pending"}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ─── ADMIN VIEW ─────────────────────────────────────────────────── */
          <div className="space-y-5 max-w-lg mx-auto">
            {/* Today's status */}
            {(() => {
              const myAtt = attendanceRecords.find(r => r.adminId === user?.id);
              const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
              return (
                <div className="glass-card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)" }}>
                      <CalendarClock size={20} style={{ color: "var(--accent-primary)" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Status Hari Ini</p>
                      <p className="text-xs text-[var(--text-muted)]">{todayWIB()} • {now} WIB</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">Check-In</p>
                      <p className={`text-lg font-bold font-mono ${myAtt?.checkInAt ? "text-emerald-400" : "text-[var(--text-muted)]"}`}>
                        {myAtt?.checkInAt ? fmtTime(myAtt.checkInAt) : "--:--"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl text-center" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-1">Check-Out</p>
                      <p className={`text-lg font-bold font-mono ${myAtt?.checkOutAt ? "text-indigo-400" : "text-[var(--text-muted)]"}`}>
                        {myAtt?.checkOutAt ? fmtTime(myAtt.checkOutAt) : "--:--"}
                      </p>
                    </div>
                  </div>
                  {!myAtt && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}>
                      <AlertCircle size={13} className="text-amber-400 flex-shrink-0" />
                      <span className="text-amber-300">Absensi otomatis terkirim via webhook sesuai jadwal shift kamu.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Task list */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} style={{ color: "var(--accent-primary)" }} />
                  <p className="text-sm font-semibold text-white">Tugas Hari Ini</p>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {myAssignments.filter(a => a.status === "done").length}/{myAssignments.length} selesai
                </span>
              </div>

              {/* Progress bar */}
              {myAssignments.length > 0 && (
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(myAssignments.filter(a => a.status === "done").length / myAssignments.length) * 100}%`, background: "var(--gradient-primary)" }} />
                </div>
              )}

              {myAssignments.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">Tidak ada tugas yang diassign untuk hari ini.</p>
              ) : (
                <div className="space-y-2">
                  {myAssignments.map(assignment => (
                    <div key={assignment.id}
                      onClick={() => toggleTask(assignment)}
                      className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/[0.03]"
                      style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex-shrink-0 mt-0.5">
                        {assignment.status === "done"
                          ? <CheckCircle2 size={18} className="text-emerald-400" />
                          : <Circle size={18} className="text-[var(--text-muted)]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium transition-all ${assignment.status === "done" ? "line-through text-[var(--text-muted)]" : "text-white"}`}>
                          {assignment.task.title}
                        </p>
                        {assignment.task.description && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{assignment.task.description}</p>
                        )}
                        {assignment.completedAt && (
                          <p className="text-[10px] text-emerald-400 mt-0.5">✓ Selesai {fmtTime(assignment.completedAt)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
