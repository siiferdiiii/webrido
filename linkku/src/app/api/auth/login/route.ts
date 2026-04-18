import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword, signToken, setAuthCookie } from "@/lib/auth";
import { DEFAULT_ADMIN_PERMISSIONS } from "@/lib/auth";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "Akun belum aktif. Hubungi Developer untuk aktivasi." }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "developer" | "admin",
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Suppress unused import warning — hashPassword used if we add password change later
void hashPassword;
void DEFAULT_ADMIN_PERMISSIONS;
