import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/affiliate-auth";

// GET /api/affiliate-portal/commissions — Commission history
export async function GET(req: NextRequest) {
  const auth = await requireAffiliate();
  if ("error" in auth) return auth.error;

  try {
    const { affiliate } = auth;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const [commissions, total] = await Promise.all([
      prisma.affiliateCommission.findMany({
        where: { affiliateId: affiliate.id },
        include: {
          user: { select: { name: true } },
          transaction: { select: { productName: true, amount: true, purchaseDate: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.affiliateCommission.count({ where: { affiliateId: affiliate.id } }),
    ]);

    return NextResponse.json({
      commissions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
