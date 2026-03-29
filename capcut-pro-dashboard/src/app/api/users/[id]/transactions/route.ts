import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: id },
      orderBy: { purchaseDate: 'desc' },
      include: {
        stockAccount: {
          select: { accountEmail: true, productType: true }
        }
      }
    });

    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    console.error(`GET /api/users/[id]/transactions error:`, error);
    return NextResponse.json({ error: "Gagal mengambil histori transaksi" }, { status: 500 });
  }
}
