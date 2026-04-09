import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireDeveloper } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/users/[id]/tasks?date=2026-04-09
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ||
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    const [admin, assignments, schedule, attendance] = await Promise.all([
      prisma.adminUser.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, whatsapp: true, status: true, role: true },
      }),
      prisma.taskAssignment.findMany({
        where: { adminId: id, date },
        include: { task: { select: { title: true, description: true, recurrenceType: true } } },
        orderBy: { assignedAt: "asc" },
      }),
      prisma.adminSchedule.findUnique({ where: { adminId: id } }),
      prisma.attendanceRecord.findUnique({ where: { adminId_date: { adminId: id, date } } }),
    ]);

    if (!admin) return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });

    const doneCount = assignments.filter(a => a.status === "done").length;

    return NextResponse.json({
      admin,
      schedule,
      attendance,
      assignments,
      summary: {
        total: assignments.length,
        done: doneCount,
        pending: assignments.length - doneCount,
        completionPct: assignments.length > 0 ? Math.round((doneCount / assignments.length) * 100) : 0,
      },
      date,
    });
  } catch (error) {
    console.error("GET /api/admin/users/[id]/tasks error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
