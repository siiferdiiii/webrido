import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/users/[id] - Ambil detail user beserta riwayat
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        transactions: {
          include: { stockAccount: true },
          orderBy: { purchaseDate: "desc" },
        },
        messageLogs: { orderBy: { sentAt: "desc" }, take: 20 },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json({ error: "Gagal mengambil data user" }, { status: 500 });
  }
}

// PATCH /api/users/[id] - Update data user
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, whatsapp, notes, customerType, followUpStatus, subscriptionStatus } = body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(whatsapp !== undefined && { whatsapp }),
        ...(notes !== undefined && { notes }),
        ...(customerType !== undefined && { customerType }),
        ...(followUpStatus !== undefined && { followUpStatus }),
        ...(subscriptionStatus !== undefined && { subscriptionStatus }),
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
    return NextResponse.json({ error: "Gagal mengupdate user" }, { status: 500 });
  }
}
