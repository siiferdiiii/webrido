import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, signAffiliateToken, setAffiliateCookie } from "@/lib/affiliate-auth";

// POST /api/affiliate-portal/auth/login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!affiliate) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    if (affiliate.status !== "active") {
      return NextResponse.json({ error: "Akun affiliate tidak aktif" }, { status: 403 });
    }

    if (!affiliate.password) {
      return NextResponse.json({ error: "Akun belum diaktivasi. Gunakan invite link dari admin." }, { status: 403 });
    }

    const valid = await verifyPassword(password, affiliate.password);
    if (!valid) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    const token = await signAffiliateToken({
      id: affiliate.id,
      email: affiliate.email!,
      name: affiliate.name,
      role: "affiliate",
    });

    await setAffiliateCookie(token);

    return NextResponse.json({
      success: true,
      affiliate: { id: affiliate.id, name: affiliate.name, email: affiliate.email },
    });
  } catch (error) {
    console.error("Affiliate login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
