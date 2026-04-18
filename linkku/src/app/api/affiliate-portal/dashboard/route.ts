import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/affiliate-auth";

// GET /api/affiliate-portal/dashboard — Dashboard stats for affiliate
export async function GET() {
  const auth = await requireAffiliate();
  if ("error" in auth) return auth.error;

  try {
    const { affiliate } = auth;

    // Get affiliate data with counts
    const data = await prisma.affiliate.findUnique({
      where: { id: affiliate.id },
      select: {
        id: true,
        name: true,
        email: true,
        commissionRate: true,
        totalEarned: true,
        balance: true,
        _count: { select: { referredUsers: true, commissions: true, withdrawals: true } },
      },
    });

    if (!data) {
      return NextResponse.json({ error: "Affiliate tidak ditemukan" }, { status: 404 });
    }

    // Recent commissions (last 10)
    const recentCommissions = await prisma.affiliateCommission.findMany({
      where: { affiliateId: affiliate.id },
      include: {
        user: { select: { name: true } },
        transaction: { select: { productName: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Monthly commission stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const allCommissions = await prisma.affiliateCommission.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: { gte: sixMonthsAgo },
      },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by month
    const monthlyStats: Record<string, number> = {};
    allCommissions.forEach((c) => {
      const month = new Date(c.createdAt!).toISOString().slice(0, 7); // "2026-04"
      monthlyStats[month] = (monthlyStats[month] || 0) + Number(c.amount);
    });

    return NextResponse.json({
      affiliate: data,
      recentCommissions,
      monthlyStats,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
