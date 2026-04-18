import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, signAffiliateToken, setAffiliateCookie } from "@/lib/affiliate-auth";

// POST /api/affiliate-portal/auth/setup — Set password via invite token
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token dan password wajib diisi" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
    }

    // Find affiliate by invite token
    const affiliate = await prisma.affiliate.findUnique({
      where: { inviteToken: token },
    });

    if (!affiliate) {
      return NextResponse.json({ error: "Invite link tidak valid atau sudah digunakan" }, { status: 400 });
    }

    if (affiliate.status !== "active") {
      return NextResponse.json({ error: "Akun affiliate tidak aktif" }, { status: 403 });
    }

    // Hash password and clear invite token
    const hashedPassword = await hashPassword(password);

    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        password: hashedPassword,
        inviteToken: null, // Invalidate invite token after use
      },
    });

    // Auto-login after setup
    const jwtToken = await signAffiliateToken({
      id: affiliate.id,
      email: affiliate.email!,
      name: affiliate.name,
      role: "affiliate",
    });

    await setAffiliateCookie(jwtToken);

    return NextResponse.json({
      success: true,
      message: "Password berhasil diatur",
      affiliate: { id: affiliate.id, name: affiliate.name, email: affiliate.email },
    });
  } catch (error) {
    console.error("Affiliate setup error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET /api/affiliate-portal/auth/setup?token=xxx — Validate invite token
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ valid: false, error: "Token diperlukan" }, { status: 400 });
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { inviteToken: token },
      select: { id: true, name: true, email: true, status: true, password: true },
    });

    if (!affiliate) {
      return NextResponse.json({ valid: false, error: "Invite link tidak valid atau sudah digunakan" });
    }

    if (affiliate.password) {
      return NextResponse.json({ valid: false, error: "Akun sudah diaktivasi. Silakan login." });
    }

    return NextResponse.json({
      valid: true,
      affiliate: { name: affiliate.name, email: affiliate.email },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
