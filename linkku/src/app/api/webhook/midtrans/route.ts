import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import {
  verifySignature,
  isPaymentSuccess,
  isPaymentFailed,
} from "@/lib/midtrans";

// POST /api/webhook/midtrans — Handle Midtrans payment notifications
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      order_id,
      transaction_status,
      fraud_status,
      status_code,
      gross_amount,
      signature_key,
    } = body;

    console.log(`[Midtrans Webhook] order_id=${order_id} status=${transaction_status}`);

    // 1. Verify signature
    const isValid = await verifySignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    );

    if (!isValid) {
      console.error("[Midtrans Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // 2. Find transaction by lynkIdRef (which stores our order_id)
    const transaction = await prisma.transaction.findFirst({
      where: { lynkIdRef: order_id },
      include: { user: true },
    });

    if (!transaction) {
      console.error(`[Midtrans Webhook] Transaction not found: ${order_id}`);
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // 3. Update transaction status based on payment result
    if (isPaymentSuccess(transaction_status, fraud_status)) {
      // Payment successful — update status
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "success",
          purchaseDate: new Date(),
        },
      });

      // Detect product type from productName
      const productName = (transaction.productName || "").toLowerCase();
      const isDesktop = productName.includes("desktop") || productName.includes("pc") || productName.includes("mac");
      const productType = isDesktop ? "desktop" : "mobile";

      // Auto-assign stock account matching product type
      try {
        const availableStock = await prisma.stockAccount.findFirst({
          where: {
            status: "available",
            productType,
          },
          orderBy: { createdAt: "asc" },
        });

        // Fallback: if no matching type, try any available
        const stock = availableStock || await prisma.stockAccount.findFirst({
          where: { status: "available" },
          orderBy: { createdAt: "asc" },
        });

        if (stock) {
          const warrantyDays = stock.durationDays || 30;
          const warrantyExpiredAt = new Date();
          warrantyExpiredAt.setDate(warrantyExpiredAt.getDate() + warrantyDays);

          const newUsedSlots = (stock.usedSlots || 0) + 1;
          const maxSlots = stock.maxSlots || 3;

          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                stockAccountId: stock.id,
                warrantyExpiredAt,
              },
            }),
            prisma.stockAccount.update({
              where: { id: stock.id },
              data: {
                usedSlots: { increment: 1 },
                status: newUsedSlots >= maxSlots ? "sold" : "in_use",
              },
            }),
          ]);

          console.log(`[Midtrans Webhook] Auto-assigned ${stock.accountEmail} (${stock.productType}) to ${order_id}`);
        } else {
          console.log(`[Midtrans Webhook] No available stock for ${order_id} — admin needs to assign manually`);
        }
      } catch (stockErr) {
        console.error("[Midtrans Webhook] Auto-assign stock failed:", stockErr);
      }

      console.log(`[Midtrans Webhook] Payment SUCCESS for ${order_id}`);
    } else if (isPaymentFailed(transaction_status)) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "failed" },
      });
      console.log(`[Midtrans Webhook] Payment FAILED for ${order_id}`);
    } else {
      console.log(`[Midtrans Webhook] Status ${transaction_status} for ${order_id} — no action`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Midtrans Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
