import { NextResponse } from "next/server";
import { getAffiliateUser, clearAffiliateCookie } from "@/lib/affiliate-auth";
import { prisma } from "@/lib/db";

// GET /api/affiliate-portal/auth/me
export async function GET() {
  try {
    const affiliate = await getAffiliateUser();
    if (!affiliate) {
      return NextResponse.json({ affiliate: null }, { status: 401 });
    }

    // Fetch fresh data from DB
    const dbAffiliate = await prisma.affiliate.findUnique({
      where: { id: affiliate.id },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        commissionRate: true,
        totalEarned: true,
        balance: true,
        status: true,
      },
    });

    if (!dbAffiliate || dbAffiliate.status !== "active") {
      return NextResponse.json({ affiliate: null }, { status: 401 });
    }

    return NextResponse.json({ affiliate: dbAffiliate });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/affiliate-portal/auth/logout
export async function POST() {
  await clearAffiliateCookie();
  return NextResponse.json({ success: true });
}
