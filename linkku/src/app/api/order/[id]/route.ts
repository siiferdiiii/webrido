import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTransactionStatus, isPaymentSuccess, isPaymentFailed } from "@/lib/midtrans";

/**
 * GET /api/order/[id]
 *
 * Public endpoint — no auth required.
 * Fetch transaction details by ID for customer order page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, whatsapp: true } },
        stockAccount: { select: { accountEmail: true, accountPassword: true, status: true, durationDays: true, productType: true } },
        warrantyClaims: {
          include: {
            oldAccount: { select: { accountEmail: true, accountPassword: true } },
            newAccount: { select: { accountEmail: true, accountPassword: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // ─── Proactive Midtrans Sync ─────────────────────────────────────────────
    // If pending, check Midtrans directly in case webhook failed or delayed
    if (transaction.status === "pending" && transaction.lynkIdRef) {
      try {
        const midtransRes = await getTransactionStatus(transaction.lynkIdRef);
        console.log(`[Order Sync] Status for ${transaction.lynkIdRef}: ${midtransRes.transaction_status}`);

        if (isPaymentSuccess(midtransRes.transaction_status, midtransRes.fraud_status)) {
          // Detect product type
          const productName = (transaction.productName || "").toLowerCase();
          const isDesktop = productName.includes("desktop") || productName.includes("pc") || productName.includes("mac");
          const productType = isDesktop ? "desktop" : "mobile";

          // Auto-assign stock
          const availableStock = await prisma.stockAccount.findFirst({
            where: { status: "available", productType },
            orderBy: { createdAt: "asc" },
          }) || await prisma.stockAccount.findFirst({
            where: { status: "available" },
            orderBy: { createdAt: "asc" },
          });

          if (availableStock) {
            const warrantyDays = availableStock.durationDays || 30;
            const warrantyExpiredAt = new Date();
            warrantyExpiredAt.setDate(warrantyExpiredAt.getDate() + warrantyDays);
            const newUsedSlots = (availableStock.usedSlots || 0) + 1;
            const maxSlots = availableStock.maxSlots || 3;

            await prisma.$transaction([
              prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: "success", purchaseDate: new Date(), stockAccountId: availableStock.id, warrantyExpiredAt },
              }),
              prisma.stockAccount.update({
                where: { id: availableStock.id },
                data: { usedSlots: { increment: 1 }, status: newUsedSlots >= maxSlots ? "sold" : "in_use" },
              }),
            ]);
          } else {
            // Success but no stock
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: "success", purchaseDate: new Date() },
            });
          }

          // Refetch to get updated data
          const updatedTx = await prisma.transaction.findUnique({
            where: { id },
            include: { user: true, stockAccount: true, warrantyClaims: { include: { oldAccount: true, newAccount: true } } },
          });
          if (updatedTx) transaction = updatedTx as any;

        } else if (isPaymentFailed(midtransRes.transaction_status)) {
          await prisma.transaction.update({ where: { id: transaction.id }, data: { status: "failed" } });
          const updatedTx = await prisma.transaction.findUnique({
            where: { id },
            include: { user: true, stockAccount: true, warrantyClaims: { include: { oldAccount: true, newAccount: true } } },
          });
          if (updatedTx) transaction = updatedTx as any;
        }
      } catch (err) {
        console.error("[Order Sync] Sync failed:", err);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Calculate warranty status
    const warrantyActive = transaction!.warrantyExpiredAt
      ? new Date(transaction!.warrantyExpiredAt) > new Date()
      : false;

    return NextResponse.json({
      id: transaction!.id,
      productName: transaction!.productName,
      amount: transaction!.amount,
      status: transaction!.status,
      purchaseDate: transaction!.purchaseDate,
      warrantyExpiredAt: transaction!.warrantyExpiredAt,
      warrantyActive,
      customer: transaction!.user
        ? {
            name: transaction!.user.name,
            email: transaction!.user.email,
            whatsapp: transaction!.user.whatsapp,
          }
        : null,
      account: transaction!.stockAccount
        ? {
            email: transaction!.stockAccount.accountEmail,
            password: transaction!.stockAccount.accountPassword,
            type: transaction!.stockAccount.productType,
            duration: transaction!.stockAccount.durationDays,
          }
        : null,
      warrantyClaims: transaction!.warrantyClaims.map((wc) => ({
        id: wc.id,
        reason: wc.claimReason,
        status: wc.status,
        createdAt: wc.createdAt,
        oldAccount: wc.oldAccount
          ? {
              email: wc.oldAccount.accountEmail,
              password: wc.oldAccount.accountPassword,
            }
          : null,
        newAccount: wc.newAccount
          ? {
              email: wc.newAccount.accountEmail,
              password: wc.newAccount.accountPassword,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("GET /api/order/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
