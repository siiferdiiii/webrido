import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/affiliates/[id]/withdraw - Admin kurangi saldo affiliate secara manual
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { amount, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Jumlah withdraw harus lebih dari 0" }, { status: 400 });
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate tidak ditemukan" }, { status: 404 });
    }

    if (Number(affiliate.balance) < amount) {
      return NextResponse.json({ error: `Saldo tidak cukup. Saldo saat ini: Rp ${affiliate.balance}` }, { status: 400 });
    }

    // Buat record withdrawal + kurangi saldo
    const [withdrawal] = await prisma.$transaction([
      prisma.affiliateWithdrawal.create({
        data: {
          affiliateId: id,
          amount,
          status: "approved",
          notes: notes || "Withdraw manual oleh admin",
          processedAt: new Date(),
        },
      }),
      prisma.affiliate.update({
        where: { id },
        data: {
          balance: { decrement: amount },
        },
      }),
    ]);

    return NextResponse.json({ withdrawal, message: `Berhasil mengurangi saldo Rp ${amount}` });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
