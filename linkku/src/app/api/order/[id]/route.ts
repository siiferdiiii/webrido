import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            whatsapp: true,
          },
        },
        stockAccount: {
          select: {
            accountEmail: true,
            accountPassword: true,
            status: true,
            durationDays: true,
            productType: true,
          },
        },
        warrantyClaims: {
          include: {
            oldAccount: {
              select: {
                accountEmail: true,
                accountPassword: true,
              },
            },
            newAccount: {
              select: {
                accountEmail: true,
                accountPassword: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan" },
        { status: 404 }
      );
    }

    // Calculate warranty status
    const warrantyActive = transaction.warrantyExpiredAt
      ? new Date(transaction.warrantyExpiredAt) > new Date()
      : false;

    return NextResponse.json({
      id: transaction.id,
      productName: transaction.productName,
      amount: transaction.amount,
      status: transaction.status,
      purchaseDate: transaction.purchaseDate,
      warrantyExpiredAt: transaction.warrantyExpiredAt,
      warrantyActive,
      customer: transaction.user
        ? {
            name: transaction.user.name,
            email: transaction.user.email,
            whatsapp: transaction.user.whatsapp,
          }
        : null,
      account: transaction.stockAccount
        ? {
            email: transaction.stockAccount.accountEmail,
            password: transaction.stockAccount.accountPassword,
            type: transaction.stockAccount.productType,
            duration: transaction.stockAccount.durationDays,
          }
        : null,
      warrantyClaims: transaction.warrantyClaims.map((wc) => ({
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
