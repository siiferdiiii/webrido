import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/affiliates/[id]/referrals - Tambah referral manual ke affiliate
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; // ID dari Affiliate
    const body = await req.json();
    const { userId } = body; // ID dari User (Customer)

    if (!userId) {
      return NextResponse.json({ error: "userId wajib diisi" }, { status: 400 });
    }

    // Pastikan affiliate exists
    const affiliate = await prisma.affiliate.findUnique({
      where: { id },
    });

    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate tidak ditemukan" }, { status: 404 });
    }

    // Pastikan user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // Update user untuk menetapkan affiliate ini sebagai referredBy
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        referredBy: id,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });

  } catch (error) {
    console.error("[Add Referral] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
