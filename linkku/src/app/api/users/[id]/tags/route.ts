import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/users/[id]/tags - Ambil semua tag milik user
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const customerTags = await prisma.customerTag.findMany({
      where: { userId: id },
      include: { tag: true },
      orderBy: { assignedAt: "asc" },
    });

    return NextResponse.json({ tags: customerTags.map((ct) => ct.tag) });
  } catch (error) {
    console.error("GET /api/users/[id]/tags error:", error);
    return NextResponse.json({ error: "Gagal mengambil tags pelanggan" }, { status: 500 });
  }
}

// POST /api/users/[id]/tags - Assign tag ke user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: "tagId wajib diisi" }, { status: 400 });
    }

    await prisma.customerTag.create({
      data: { userId: id, tagId },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Tag sudah di-assign ke pelanggan ini" }, { status: 409 });
    }
    console.error("POST /api/users/[id]/tags error:", error);
    return NextResponse.json({ error: "Gagal assign tag" }, { status: 500 });
  }
}

// DELETE /api/users/[id]/tags - Remove tag dari user (body: { tagId })
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: "tagId wajib diisi" }, { status: 400 });
    }

    await prisma.customerTag.delete({
      where: { userId_tagId: { userId: id, tagId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users/[id]/tags error:", error);
    return NextResponse.json({ error: "Gagal menghapus tag dari pelanggan" }, { status: 500 });
  }
}
