import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/affiliate-auth";
import { topupDANA } from "@/lib/orderkuota";

const MIN_PAYOUT = 10000; // Minimum Rp 10.000
const MAX_PAYOUT = 1000000; // Maksimum Rp 1.000.000

// POST /api/affiliate-portal/payout — Request payout
export async function POST(req: NextRequest) {
  const auth = await requireAffiliate();
  if ("error" in auth) return auth.error;

  try {
    const { affiliate } = auth;
    const body = await req.json();
    const { amount, method, accountNumber, accountName } = body;

    console.log(`[Payout] Request: affiliate=${affiliate.id}, amount=${amount}, method=${method}, dest=${accountNumber}`);

    if (!amount || !method || !accountNumber) {
      return NextResponse.json({ error: "Jumlah, metode, dan nomor akun wajib diisi" }, { status: 400 });
    }

    if (amount < MIN_PAYOUT) {
      return NextResponse.json({ error: `Minimum payout Rp ${MIN_PAYOUT.toLocaleString("id-ID")}` }, { status: 400 });
    }

    if (amount > MAX_PAYOUT) {
      return NextResponse.json({ error: `Maksimum payout Rp ${MAX_PAYOUT.toLocaleString("id-ID")}` }, { status: 400 });
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

    // Check for pending/processing payout
    const activePayout = await prisma.affiliateWithdrawal.findFirst({
      where: {
        affiliateId: affiliate.id,
        status: { in: ["pending", "processing"] },
      },
    });

    if (activePayout) {
      return NextResponse.json({ error: "Masih ada permintaan payout yang sedang diproses. Tunggu sampai selesai." }, { status: 400 });
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
    console.log(`[Payout] Withdrawal created: ${withdrawal.id}`);

    // Deduct balance immediately
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        balance: { decrement: amount },
      },
    });
    console.log(`[Payout] Balance deducted: -${amount}`);

    // ── DANA: Auto top-up via OrderKuota ────────────────────────────────
    if (method === "dana") {
      try {
        const result = await topupDANA(accountNumber, amount, withdrawal.id);
        console.log(`[Payout] OrderKuota result: success=${result.success}, raw=${result.raw}`);

        if (result.success) {
          // Transaction submitted successfully, waiting for callback
          await prisma.affiliateWithdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: "processing",
              notes: notes + ` | OrderKuota: ${result.data?.trxid || "submitted"}`,
            },
          });

          console.log(`[Payout] ✅ DANA top-up submitted, withdrawal=${withdrawal.id}`);

          return NextResponse.json({
            success: true,
            message: "Top up DANA sedang diproses. Saldo akan masuk dalam beberapa menit.",
            withdrawal: { ...withdrawal, status: "processing" },
          });
        } else {
          console.log(`[Payout] ❌ OrderKuota failed: ${result.error || result.raw}`);

          // API call failed — refund balance, mark as rejected
          await prisma.affiliate.update({
            where: { id: affiliate.id },
            data: { balance: { increment: amount } },
          });

          await prisma.affiliateWithdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: "rejected",
              notes: notes + ` | Gagal: ${(result.error || result.raw || "Unknown error").substring(0, 200)}`,
              processedAt: new Date(),
            },
          });

          return NextResponse.json({
            error: "Gagal memproses top up DANA. Saldo telah dikembalikan.",
          }, { status: 500 });
        }
      } catch (apiError) {
        console.error(`[Payout] ❌ Exception:`, apiError);

        // Exception — refund balance
        try {
          await prisma.affiliate.update({
            where: { id: affiliate.id },
            data: { balance: { increment: amount } },
          });

          await prisma.affiliateWithdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: "rejected",
              notes: notes + ` | Error: ${String(apiError).substring(0, 200)}`,
              processedAt: new Date(),
            },
          });
        } catch (refundErr) {
          console.error(`[Payout] ❌ Refund also failed:`, refundErr);
        }

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
    console.error(`[Payout] ❌ Unhandled error:`, error);
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
