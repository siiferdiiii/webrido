import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/tags - Ambil semua tag
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { customers: true } },
      },
    });
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json({ error: "Gagal mengambil tags" }, { status: 500 });
  }
}

// POST /api/tags - Buat tag baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, color } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nama tag wajib diisi" }, { status: 400 });
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color || "#818cf8",
      },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Nama tag sudah digunakan" }, { status: 409 });
    }
    console.error("POST /api/tags error:", error);
    return NextResponse.json({ error: "Gagal membuat tag" }, { status: 500 });
  }
}
