import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/tags/[id] - Hapus tag (relasi customer_tags terhapus otomatis via CASCADE)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      return NextResponse.json({ error: "Tag tidak ditemukan" }, { status: 404 });
    }

    await prisma.tag.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Tag berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/tags/[id] error:", error);
    return NextResponse.json({ error: "Gagal menghapus tag" }, { status: 500 });
  }
}

// PATCH /api/tags/[id] - Update nama atau warna tag
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, color } = body;

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
      },
    });

    return NextResponse.json({ tag });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Nama tag sudah digunakan" }, { status: 409 });
    }
    console.error("PATCH /api/tags/[id] error:", error);
    return NextResponse.json({ error: "Gagal mengupdate tag" }, { status: 500 });
  }
}
