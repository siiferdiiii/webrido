import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/attendance?date=2026-04-09&adminId=xxx
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ||
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const adminId = searchParams.get("adminId") || undefined;

    // Admin can only see their own; developer sees all
    const filter = auth.user.role !== "developer"
      ? { adminId: auth.user.id, date }
      : { date, ...(adminId && { adminId }) };

    const records = await prisma.attendanceRecord.findMany({
      where: filter,
      include: {
        admin: { select: { id: true, name: true, email: true, whatsapp: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ records, date });
  } catch (error) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
