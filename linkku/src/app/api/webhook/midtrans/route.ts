import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import {
  verifySignature,
  isPaymentSuccess,
  isPaymentFailed,
} from "@/lib/midtrans";
import { sendTemplatedWhatsApp } from "@/lib/mpwa";
import { resolveProductSku } from "@/lib/product";

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

      // ===== [AFFILIATE COMMISSION LOGIC] =====
      if (transaction.user?.referredBy && transaction.user.referredBy !== "undefined" && transaction.user.referredBy.length > 10) {
        try {
          const affId = transaction.user.referredBy;
          
          // Check for duplicate commission FIRST to prevent double counting
          const existingCommission = await prisma.affiliateCommission.findFirst({
            where: { transactionId: transaction.id }
          });

          if (!existingCommission) {
            const affiliate = await prisma.affiliate.findUnique({ where: { id: affId } });
            if (affiliate && affiliate.status === "active") {
              const rate = Number(affiliate.commissionRate) || 0;
              const price = Number(gross_amount);
              const commAmount = Math.round((price * rate) / 100);

              if (commAmount > 0) {
                await prisma.$transaction([
                  prisma.affiliateCommission.create({
                    data: {
                      affiliateId: affId,
                      transactionId: transaction.id,
                      userId: transaction.userId,
                      amount: commAmount,
                      transactionAmount: price,
                      status: "credited",
                    }
                  }),
                  prisma.affiliate.update({
                    where: { id: affId },
                    data: {
                      balance: { increment: commAmount },
                      totalEarned: { increment: commAmount },
                    }
                  })
                ]);
                console.log(`[Midtrans Webhook] Affiliate commission ${commAmount} processed for ${affId} from Trx ${transaction.id}`);
              }
            }
          }
        } catch (affErr) {
          console.error("[Midtrans Webhook] Affiliate commission error:", affErr);
        }
      }
      // ========================================


      // Fetch products to map productName -> SKU
      const { sku: targetSku, baseType } = await resolveProductSku(transaction.productName || "");

      // Auto-assign stock account strictly matching product SKU/Type
      try {
        const typeConditions: any[] = [
          { productType: { equals: baseType, mode: "insensitive" } }
        ];
        if (targetSku) {
          typeConditions.push({ productType: { equals: targetSku, mode: "insensitive" } });
        }

        const stock = await prisma.stockAccount.findFirst({
          where: {
            status: { in: ["available", "in_use"] },
            OR: typeConditions,
          },
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

          // Fire WA notification
          if (transaction.user?.whatsapp) {
            try {
              const settingTemplate = await prisma.appSetting.findUnique({ where: { key: "template_payment_success" } });
              if (settingTemplate && settingTemplate.value) {
                await sendTemplatedWhatsApp(
                  transaction.user.whatsapp,
                  settingTemplate.value,
                  {
                    nama: transaction.user.name,
                    produk: transaction.productName,
                    link_transaksi: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/order/${transaction.id}`,
                  }
                );
                await prisma.messageLog.create({
                  data: {
                    userId: transaction.user.id,
                    transactionId: transaction.id,
                    whatsappNumber: transaction.user.whatsapp,
                    messageType: "payment_success_notification",
                    messageContent: `Sent order tracking link for: ${transaction.productName}`,
                    status: "sent",
                  },
                });
              }
            } catch (waErr) {
              console.error("[Midtrans Webhook] WA notification failed:", waErr);
            }
          }
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
