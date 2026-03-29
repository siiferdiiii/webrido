import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/affiliates/[id] - Detail affiliate + riwayat komisi & withdraw
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const affiliate = await prisma.affiliate.findUnique({
      where: { id },
      include: {
        referredUsers: { select: { id: true, name: true, email: true, whatsapp: true } },
        commissions: {
          include: {
            transaction: { select: { id: true, amount: true, createdAt: true } },
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        withdrawals: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ affiliate });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PATCH /api/affiliates/[id] - Update data affiliate
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const affiliate = await prisma.affiliate.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ affiliate });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
