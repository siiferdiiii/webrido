import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { signAffiliateToken, setAffiliateCookie, hashPassword } from "@/lib/affiliate-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!transaction || !transaction.user) {
      return NextResponse.json({ error: "Order atau user tidak ditemukan" }, { status: 404 });
    }

    const emailStr = transaction.user.email?.toLowerCase().trim();
    if (!emailStr) {
      return NextResponse.json({ error: "Email user tidak valid." }, { status: 400 });
    }

    // Cari affiliate berdasarkan email user
    let affiliate = await prisma.affiliate.findUnique({
      where: { email: emailStr },
    });

    let generatedPassword = "";

    if (!affiliate) {
      // Auto-create affiliate khusus dari halaman order dengan komisi default 20%
      generatedPassword = transaction.user.whatsapp || Math.random().toString(36).slice(-8); // Default password: nomor WA
      const hashedPassword = await hashPassword(generatedPassword);
      
      affiliate = await prisma.affiliate.create({
        data: {
          name: transaction.user.name,
          email: emailStr,
          whatsapp: transaction.user.whatsapp,
          password: hashedPassword,
          commissionRate: 20, // Set auto 20% commission
          status: "active",
        },
      });
    } else {
        // Jika statusnya pending, kita buat active
        if (affiliate.status !== "active") {
            await prisma.affiliate.update({
                where: { id: affiliate.id },
                data: { status: "active" }
            });
        }
    }

    // Sign the affiliate token and set cookie (auto-login bypass)
    const token = await signAffiliateToken({
      id: affiliate.id,
      email: affiliate.email!,
      name: affiliate.name,
      role: "affiliate",
    });

    await setAffiliateCookie(token);

    return NextResponse.json({
      success: true,
      redirect: "/affiliate/",
      password: generatedPassword || null
    });
  } catch (error) {
    console.error("Auto Affiliate POST error:", error);
    return NextResponse.json({ error: "Gagal membuat affiliate secara otomatis" }, { status: 500 });
  }
}
