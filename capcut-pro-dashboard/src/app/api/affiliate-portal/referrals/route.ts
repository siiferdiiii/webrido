import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/affiliate-auth";

// GET /api/affiliate-portal/referrals — List referrals (masked emails)
export async function GET(req: NextRequest) {
  const auth = await requireAffiliate();
  if ("error" in auth) return auth.error;

  try {
    const { affiliate } = auth;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {
      referredBy: affiliate.id,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const [referrals, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true, // Will be masked on frontend
          createdAt: true,
          subscriptionStatus: true,
          _count: { select: { transactions: true } },
          transactions: {
            select: { amount: true, status: true },
            where: { status: "success" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Mask emails and calculate total spent per referral
    const maskedReferrals = referrals.map((r) => {
      const email = r.email;
      const [localPart, domain] = email.split("@");
      const maskedEmail = localPart.charAt(0) + "***" + (localPart.length > 1 ? localPart.charAt(localPart.length - 1) : "") + "@" + domain;

      const totalSpent = r.transactions.reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        id: r.id,
        name: r.name,
        email: maskedEmail,
        createdAt: r.createdAt,
        subscriptionStatus: r.subscriptionStatus,
        totalTransactions: r._count.transactions,
        totalSpent,
      };
    });

    return NextResponse.json({
      referrals: maskedReferrals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
