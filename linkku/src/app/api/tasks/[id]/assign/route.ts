import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireDeveloper } from "@/lib/auth";

// POST /api/tasks/[id]/assign — assign/unassign task to admin(s)
// body: { adminIds: string[], date?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { id: taskId } = await params;
    const { adminIds, action = "assign" } = await req.json();

    if (!Array.isArray(adminIds) || adminIds.length === 0) {
      return NextResponse.json({ error: "adminIds wajib diisi" }, { status: 400 });
    }

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    if (action === "assign") {
      // Upsert assignment for each admin (today's date)
      await Promise.all(adminIds.map((adminId: string) =>
        prisma.taskAssignment.upsert({
          where: { taskId_adminId_date: { taskId, adminId, date: today } },
          update: {},
          create: { taskId, adminId, date: today, status: "pending" },
        })
      ));
    } else if (action === "unassign") {
      await prisma.taskAssignment.deleteMany({
        where: { taskId, adminId: { in: adminIds }, date: today },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/tasks/[id]/assign error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
