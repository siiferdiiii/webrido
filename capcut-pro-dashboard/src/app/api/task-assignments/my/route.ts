import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/task-assignments/my?date=2026-04-09
// Returns today's task assignments for the logged-in admin
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ||
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    const adminId = auth.user.id;

    const assignments = await prisma.taskAssignment.findMany({
      where: { adminId, date },
      include: { task: { select: { title: true, description: true } } },
      orderBy: { assignedAt: "asc" },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("GET /api/task-assignments/my error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
