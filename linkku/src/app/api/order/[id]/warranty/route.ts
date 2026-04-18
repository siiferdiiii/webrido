import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/order/[id]/warranty
 *
 * Public endpoint — customer submits warranty claim.
 * No auth required — transaction ID acts as the "key".
 *
 * Body:
 *   - reason: string   (required) claim reason
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json(
        { error: "Alasan klaim wajib diisi (minimal 3 karakter)" },
        { status: 400 }
      );
    }

    // 1. Find the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        stockAccount: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan" },
        { status: 404 }
      );
    }

    // 2. Check warranty is still active
    if (!transaction.warrantyExpiredAt || new Date(transaction.warrantyExpiredAt) <= new Date()) {
      return NextResponse.json(
        { error: "Garansi sudah expired" },
        { status: 400 }
      );
    }

    // 3. Check no pending warranty claim
    const pendingClaim = await prisma.warrantyClaim.findFirst({
      where: {
        transactionId: id,
        status: { in: ["pending", "processing"] },
      },
    });

    if (pendingClaim) {
      return NextResponse.json(
        { error: "Sudah ada klaim garansi yang sedang diproses" },
        { status: 400 }
      );
    }

    // 4. Create warranty claim
    const claim = await prisma.warrantyClaim.create({
      data: {
        transactionId: id,
        oldAccountId: transaction.stockAccountId,
        claimReason: reason.trim(),
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Klaim garansi berhasil dikirim! Admin akan segera memprosesnya.",
      claim: {
        id: claim.id,
        reason: claim.claimReason,
        status: claim.status,
        createdAt: claim.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/order/[id]/warranty error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
