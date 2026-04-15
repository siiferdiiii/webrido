import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/affiliate-auth";

const MIN_PAYOUT = 25000; // Minimum Rp 25.000

// POST /api/affiliate-portal/payout — Request payout
export async function POST(req: NextRequest) {
  const auth = await requireAffiliate();
  if ("error" in auth) return auth.error;

  try {
    const { affiliate } = auth;
    const body = await req.json();
    const { amount, method, accountNumber, accountName } = body;

    if (!amount || !method || !accountNumber) {
      return NextResponse.json({ error: "Jumlah, metode, dan nomor akun wajib diisi" }, { status: 400 });
    }

    if (amount < MIN_PAYOUT) {
      return NextResponse.json({ error: `Minimum payout Rp ${MIN_PAYOUT.toLocaleString("id-ID")}` }, { status: 400 });
    }

    if (!["dana", "bank_transfer"].includes(method)) {
      return NextResponse.json({ error: "Metode pembayaran tidak valid. Pilih DANA atau Transfer Bank." }, { status: 400 });
    }

    // Check balance
    const aff = await prisma.affiliate.findUnique({
      where: { id: affiliate.id },
      select: { balance: true },
    });

    if (!aff || Number(aff.balance) < amount) {
      return NextResponse.json({ error: "Saldo tidak mencukupi" }, { status: 400 });
    }

    // Check for pending payout
    const pendingPayout = await prisma.affiliateWithdrawal.findFirst({
      where: { affiliateId: affiliate.id, status: "pending" },
    });

    if (pendingPayout) {
      return NextResponse.json({ error: "Masih ada permintaan payout yang sedang diproses" }, { status: 400 });
    }

    // Create withdrawal record
    const methodLabel = method === "dana" ? "DANA" : "Transfer Bank";
    const notes = `${methodLabel} - ${accountNumber}${accountName ? ` (${accountName})` : ""}`;

    const withdrawal = await prisma.affiliateWithdrawal.create({
      data: {
        affiliateId: affiliate.id,
        amount,
        status: "pending",
        notes,
      },
    });

    // Deduct balance immediately
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        balance: { decrement: amount },
      },
    });

    // TODO: Integrate with OrderKuota API for automatic payout
    // For now, withdrawal is created as 'pending' and admin will process it
    // When OrderKuota API integration is ready, uncomment below:
    /*
    try {
      const orderkuotaResult = await callOrderKuotaAPI({
        method,
        amount,
        accountNumber,
        accountName,
      });
      
      if (orderkuotaResult.success) {
        await prisma.affiliateWithdrawal.update({
          where: { id: withdrawal.id },
          data: { status: "approved", processedAt: new Date() },
        });
      }
    } catch (apiError) {
      // Refund balance if API fails
      await prisma.affiliate.update({
        where: { id: affiliate.id },
        data: { balance: { increment: amount } },
      });
      await prisma.affiliateWithdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "rejected", notes: notes + " | API Error: " + String(apiError) },
      });
    }
    */

    return NextResponse.json({
      success: true,
      message: "Permintaan payout berhasil. Akan diproses dalam 1x24 jam.",
      withdrawal,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// GET /api/affiliate-portal/payout — List payout history
export async function GET(req: NextRequest) {
  const auth = await requireAffiliate();
  if ("error" in auth) return auth.error;

  try {
    const { affiliate } = auth;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const [withdrawals, total] = await Promise.all([
      prisma.affiliateWithdrawal.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.affiliateWithdrawal.count({ where: { affiliateId: affiliate.id } }),
    ]);

    return NextResponse.json({
      withdrawals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
