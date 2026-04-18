import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// PATCH /api/task-assignments/[id] — admin centang done / undone
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const { status } = await req.json(); // "done" | "pending"

    const assignment = await prisma.taskAssignment.findUnique({ where: { id } });
    if (!assignment) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

    // Admin only can update their own assignments (Developer can update any)
    if (auth.user.role !== "developer" && assignment.adminId !== auth.user.id) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const updated = await prisma.taskAssignment.update({
      where: { id },
      data: {
        status,
        completedAt: status === "done" ? new Date() : null,
      },
    });
    return NextResponse.json({ assignment: updated });
  } catch (error) {
    console.error("PATCH /api/task-assignments/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
