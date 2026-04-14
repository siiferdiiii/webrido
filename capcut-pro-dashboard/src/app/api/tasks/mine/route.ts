import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/tasks/mine — Tugas yang didelegasi ke admin yang sedang login (hari ini)
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Jakarta",
    }); // format YYYY-MM-DD WIB

    const assignments = await prisma.taskAssignment.findMany({
      where: {
        adminId: auth.user.id,
        date: today,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            recurrenceType: true,
          },
        },
      },
      orderBy: { assignedAt: "asc" },
    });

    const pending = assignments.filter((a) => a.status === "pending").length;

    return NextResponse.json({ assignments, pending, date: today });
  } catch (error) {
    console.error("GET /api/tasks/mine error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
