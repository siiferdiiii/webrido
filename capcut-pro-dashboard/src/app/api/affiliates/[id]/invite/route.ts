import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { randomBytes } from "crypto";

// POST /api/affiliates/[id]/invite — Generate invite link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("page_affiliates");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;

    const affiliate = await prisma.affiliate.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, password: true, inviteToken: true },
    });

    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate tidak ditemukan" }, { status: 404 });
    }

    if (affiliate.password) {
      return NextResponse.json({ error: "Affiliate sudah punya password. Tidak perlu invite link lagi." }, { status: 400 });
    }

    // Generate or reuse existing invite token
    let inviteToken = affiliate.inviteToken;
    if (!inviteToken) {
      inviteToken = randomBytes(32).toString("hex");
      await prisma.affiliate.update({
        where: { id },
        data: { inviteToken },
      });
    }

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get("origin") || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/affiliate/setup?token=${inviteToken}`;

    return NextResponse.json({
      success: true,
      inviteUrl,
      inviteToken,
      affiliateName: affiliate.name,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
