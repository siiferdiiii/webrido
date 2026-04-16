import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/affiliate-auth";
import { topupDANA } from "@/lib/orderkuota";

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

    // ── DANA: Auto top-up via OrderKuota ────────────────────────────────
    if (method === "dana") {
      try {
        const result = await topupDANA(accountNumber, amount, withdrawal.id);

        if (result.success) {
          // Transaction submitted successfully, waiting for callback
          await prisma.affiliateWithdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: "processing",
              notes: notes + ` | OrderKuota: ${result.data?.trxid || "submitted"}`,
            },
          });

          return NextResponse.json({
            success: true,
            message: "Top up DANA sedang diproses. Saldo akan masuk dalam beberapa menit.",
            withdrawal: { ...withdrawal, status: "processing" },
          });
        } else {
          // API call failed — refund balance, mark as rejected
          await prisma.affiliate.update({
            where: { id: affiliate.id },
            data: { balance: { increment: amount } },
          });

          await prisma.affiliateWithdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: "rejected",
              notes: notes + ` | Gagal: ${result.error || result.raw || "Unknown error"}`,
              processedAt: new Date(),
            },
          });

          return NextResponse.json({
            error: "Gagal memproses top up DANA. Saldo telah dikembalikan.",
          }, { status: 500 });
        }
      } catch (apiError) {
        // Exception — refund balance
        await prisma.affiliate.update({
          where: { id: affiliate.id },
          data: { balance: { increment: amount } },
        });

        await prisma.affiliateWithdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "rejected",
            notes: notes + ` | Error: ${String(apiError)}`,
            processedAt: new Date(),
          },
        });

        return NextResponse.json({
          error: "Terjadi kesalahan saat memproses. Saldo telah dikembalikan.",
        }, { status: 500 });
      }
    }

    // ── Bank Transfer: Manual (admin will process) ──────────────────────
    return NextResponse.json({
      success: true,
      message: "Permintaan transfer bank berhasil. Akan diproses admin dalam 1x24 jam.",
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
