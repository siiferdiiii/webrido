import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireDeveloper } from "@/lib/auth";

// PATCH /api/admin/users/[id] — Update status or permissions
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, permissions } = body;

    // Prevent modifying developer account role
    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    if (target.role === "developer") return NextResponse.json({ error: "Akun Developer tidak bisa diubah" }, { status: 403 });

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(permissions !== undefined && { permissions }),
      },
      select: { id: true, email: true, name: true, role: true, status: true, permissions: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — Delete admin account
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;

    // Cannot delete developer or self
    if (id === auth.user.id) {
      return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 });
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    if (target.role === "developer") return NextResponse.json({ error: "Akun Developer tidak bisa dihapus" }, { status: 403 });

    await prisma.adminUser.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
