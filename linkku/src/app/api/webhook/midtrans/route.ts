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
      // Payment successful
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "success",
          purchaseDate: new Date(),
        },
      });

      // Auto-assign stock account if available
      try {
        const availableStock = await prisma.stockAccount.findFirst({
          where: {
            status: "available",
          },
          orderBy: { createdAt: "asc" },
        });

        if (availableStock) {
          // Calculate warranty expiry
          const warrantyDays = availableStock.durationDays || 30;
          const warrantyExpiredAt = new Date();
          warrantyExpiredAt.setDate(warrantyExpiredAt.getDate() + warrantyDays);

          await prisma.$transaction([
            prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                stockAccountId: availableStock.id,
                warrantyExpiredAt,
              },
            }),
            prisma.stockAccount.update({
              where: { id: availableStock.id },
              data: {
                usedSlots: { increment: 1 },
                status:
                  (availableStock.usedSlots || 0) + 1 >= (availableStock.maxSlots || 3)
                    ? "sold"
                    : "in_use",
              },
            }),
          ]);

          console.log(`[Midtrans Webhook] Auto-assigned stock ${availableStock.accountEmail} to ${order_id}`);
        }
      } catch (stockErr) {
        console.error("[Midtrans Webhook] Auto-assign stock failed:", stockErr);
        // Non-blocking — admin can manually assign later
      }

      console.log(`[Midtrans Webhook] Payment SUCCESS for ${order_id}`);
    } else if (isPaymentFailed(transaction_status)) {
      // Payment failed/cancelled
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "failed" },
      });

      console.log(`[Midtrans Webhook] Payment FAILED for ${order_id}`);
    } else {
      // Pending or other status
      console.log(`[Midtrans Webhook] Status ${transaction_status} for ${order_id} — no action`);
    }

    // Midtrans expects 200 OK
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Midtrans Webhook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
