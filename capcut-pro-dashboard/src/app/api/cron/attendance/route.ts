import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ATTENDANCE_WEBHOOK_URL =
  "https://appsheetindonesia-dorrizstore.qxifii.easypanel.host/webhook/45d33299-7803-4a43-a801-aa1126036591";

const CRON_SECRET = process.env.CRON_SECRET || "cron-secret-change-in-production";

// Helper: get current WIB time as "HH:MM"
function getWIBTime(): string {
  return new Date().toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getWIBDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// FIX #11: Cek apakah waktu sekarang dalam window ±N menit dari target
// Mencegah missed check-in/out jika n8n trigger terlambat beberapa menit
function isWithinWindow(nowWIB: string, target: string, windowMinutes = 2): boolean {
  const [nowH, nowM] = nowWIB.split(":").map(Number);
  const [tarH, tarM] = target.split(":").map(Number);
  if (isNaN(nowH) || isNaN(nowM) || isNaN(tarH) || isNaN(tarM)) return false;
  const nowTotal = nowH * 60 + nowM;
  const tarTotal = tarH * 60 + tarM;
  return Math.abs(nowTotal - tarTotal) <= windowMinutes;
}

// POST /api/cron/attendance — called by n8n every minute
// Header: x-cron-secret: [CRON_SECRET]
export async function POST(req: NextRequest) {
  // Validate cron secret
  const secret = req.headers.get("x-cron-secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowWIB = getWIBTime();   // e.g. "08:00"
  const todayWIB = getWIBDate(); // e.g. "2026-04-09"

  try {
    // Get all active admins with active schedules + their whatsapp
    const schedules = await prisma.adminSchedule.findMany({
      where: { isActive: true },
      include: {
        admin: {
          select: { id: true, name: true, email: true, whatsapp: true, status: true },
        },
      },
    });

    const results: string[] = [];

    for (const sched of schedules) {
      if (sched.admin.status !== "active") continue;

      // FIX #11: Gunakan window ±2 menit agar tidak missed jika n8n terlambat trigger
      if (isWithinWindow(nowWIB, sched.shiftStart)) {
        // Check if already sent today
        const existing = await prisma.attendanceRecord.findUnique({
          where: { adminId_date: { adminId: sched.adminId, date: todayWIB } },
        });
        if (!existing || !existing.webhookSentIn) {
          // Get today's tasks for this admin
          const dailyTasks = await prisma.task.findMany({
            where: { isActive: true, recurrenceType: "daily" },
          });
          const onceTasks = await prisma.task.findMany({
            where: { isActive: true, recurrenceType: "once", scheduledDate: todayWIB },
          });
          const todayTasks = [...dailyTasks, ...onceTasks];

          // Ensure task assignments exist for today (upsert)
          const assignedTaskIds = (await prisma.taskAssignment.findMany({
            where: { adminId: sched.adminId, date: todayWIB },
            select: { taskId: true },
          })).map(a => a.taskId);

          const newTasks = todayTasks.filter(t => !assignedTaskIds.includes(t.id));
          if (newTasks.length > 0) {
            await prisma.taskAssignment.createMany({
              data: newTasks.map(t => ({
                taskId: t.id,
                adminId: sched.adminId,
                date: todayWIB,
                status: "pending",
              })),
              skipDuplicates: true,
            });
          }

          // Upsert attendance record
          await prisma.attendanceRecord.upsert({
            where: { adminId_date: { adminId: sched.adminId, date: todayWIB } },
            update: { checkInAt: new Date(), webhookSentIn: true },
            create: {
              adminId: sched.adminId,
              date: todayWIB,
              checkInAt: new Date(),
              webhookSentIn: true,
            },
          });

          // Send webhook
          const payload = {
            type: "check_in",
            timestamp: new Date().toISOString(),
            admin: {
              name: sched.admin.name,
              email: sched.admin.email,
              whatsapp: sched.admin.whatsapp || "-",
            },
            schedule: { shift_start: sched.shiftStart, shift_end: sched.shiftEnd },
            tasks: todayTasks.map(t => ({ title: t.title, description: t.description || "" })),
          };

          try {
            await fetch(ATTENDANCE_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            results.push(`check_in sent: ${sched.admin.name}`);
          } catch (e) {
            console.error(`Failed to send check_in webhook for ${sched.admin.name}:`, e);
          }
        }
      }

      // FIX #11: Gunakan window ±2 menit
      if (isWithinWindow(nowWIB, sched.shiftEnd)) {
        const existing = await prisma.attendanceRecord.findUnique({
          where: { adminId_date: { adminId: sched.adminId, date: todayWIB } },
        });
        if (!existing || !existing.webhookSentOut) {
          // Get task completion status
          const assignments = await prisma.taskAssignment.findMany({
            where: { adminId: sched.adminId, date: todayWIB },
            include: { task: { select: { title: true } } },
          });

          await prisma.attendanceRecord.upsert({
            where: { adminId_date: { adminId: sched.adminId, date: todayWIB } },
            update: { checkOutAt: new Date(), webhookSentOut: true },
            create: {
              adminId: sched.adminId,
              date: todayWIB,
              checkOutAt: new Date(),
              webhookSentOut: true,
            },
          });

          const payload = {
            type: "check_out",
            timestamp: new Date().toISOString(),
            admin: {
              name: sched.admin.name,
              email: sched.admin.email,
              whatsapp: sched.admin.whatsapp || "-",
            },
            tasks: assignments.map(a => ({
              title: a.task.title,
              completed: a.status === "done",
              completedAt: a.completedAt?.toISOString() || null,
            })),
            summary: {
              total: assignments.length,
              done: assignments.filter(a => a.status === "done").length,
              pending: assignments.filter(a => a.status === "pending").length,
            },
          };

          try {
            await fetch(ATTENDANCE_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            results.push(`check_out sent: ${sched.admin.name}`);
          } catch (e) {
            console.error(`Failed to send check_out webhook for ${sched.admin.name}:`, e);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      time: nowWIB,
      date: todayWIB,
      processed: results,
    });
  } catch (error) {
    console.error("CRON /api/cron/attendance error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
