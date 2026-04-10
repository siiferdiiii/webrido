import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireDeveloper, requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/tasks — list all tasks with assignment counts
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assignments: {
          distinct: ["adminId"],
          select: { adminId: true, admin: { select: { name: true } } },
        },
        _count: { select: { assignments: true } },
      },
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/tasks — create new task (developer only)
export async function POST(req: NextRequest) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { title, description, recurrenceType, scheduledDate, periodStart, periodEnd } = await req.json();
    if (!title?.trim()) return NextResponse.json({ error: "Judul tugas wajib diisi" }, { status: 400 });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        recurrenceType: recurrenceType || "daily",
        scheduledDate: recurrenceType === "once" ? (scheduledDate || null) : null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
      },
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
