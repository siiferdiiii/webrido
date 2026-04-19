import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createSnapTransaction } from "@/lib/midtrans";
import { randomUUID } from "crypto";

// POST /api/checkout — Create a Midtrans Snap payment
// Public endpoint (no auth required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, whatsapp, productName, amount, productType, affiliateId } = body;

    if (!name || !email || !whatsapp || !amount) {
      return NextResponse.json(
        { error: "Nama, email, whatsapp, dan nominal wajib diisi" },
        { status: 400 }
      );
    }

    // 1. Find or create user
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          referredBy: affiliateId || null,
        },
      });
    } else if (!user.referredBy && affiliateId) {
      // Check if user doesn't have an affiliate yet, set it according to rule:
      // "Trx tidak ada afil, next ada afil → set referred_by"
      user = await prisma.user.update({
        where: { id: user.id },
        data: { referredBy: affiliateId },
      });
    }


    // 2. Create pending transaction
    const orderId = `DRZ-${Date.now()}-${randomUUID().substring(0, 6)}`;

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: parseFloat(amount),
        productName: productName || "CapCut Pro",
        status: "pending",
        isManual: false,
        lynkIdRef: orderId, // Store Midtrans order_id as reference
        purchaseDate: new Date(),
      },
    });

    // 3. Create Midtrans Snap transaction
    const snap = await createSnapTransaction({
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(parseFloat(amount)),
      },
      customer_details: {
        first_name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: whatsapp.trim(),
      },
      item_details: [
        {
          id: productType || "capcut-pro",
          price: Math.round(parseFloat(amount)),
          quantity: 1,
          name: productName || "CapCut Pro",
        },
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/order/${transaction.id}`,
      },
    });

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      orderId,
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Gagal membuat pembayaran" },
      { status: 500 }
    );
  }
}
