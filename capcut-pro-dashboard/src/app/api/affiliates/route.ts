import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/affiliates - Daftar semua affiliate
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { whatsapp: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const affiliates = await prisma.affiliate.findMany({
      where,
      include: {
        _count: { select: { referredUsers: true, commissions: true, withdrawals: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ affiliates });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/affiliates - Tambah affiliate baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, whatsapp, commissionRate } = body;

    if (!name) {
      return NextResponse.json({ error: "Nama affiliate wajib diisi" }, { status: 400 });
    }

    const affiliate = await prisma.affiliate.create({
      data: {
        name,
        email: email || null,
        whatsapp: whatsapp || null,
        commissionRate: commissionRate || 10.00,
      },
    });

    return NextResponse.json({ affiliate }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
