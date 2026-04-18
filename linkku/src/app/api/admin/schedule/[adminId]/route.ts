import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireDeveloper } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/schedule/[adminId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { adminId } = await params;
    const schedule = await prisma.adminSchedule.findUnique({ where: { adminId } });
    return NextResponse.json({ schedule });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT /api/admin/schedule/[adminId] — upsert schedule
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { adminId } = await params;
    const { shiftStart, shiftEnd, isActive } = await req.json();

    if (!shiftStart || !shiftEnd) {
      return NextResponse.json({ error: "shiftStart dan shiftEnd wajib diisi" }, { status: 400 });
    }

    const schedule = await prisma.adminSchedule.upsert({
      where: { adminId },
      update: { shiftStart, shiftEnd, ...(isActive !== undefined && { isActive }) },
      create: { adminId, shiftStart, shiftEnd, isActive: isActive ?? true },
    });
    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("PUT /api/admin/schedule/[adminId] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
