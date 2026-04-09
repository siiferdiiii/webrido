import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/auth";

// POST /api/auth/register
// Requires valid invite_token query param (except first-ever registration)
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, inviteToken } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nama, email, dan password wajib diisi" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
    }

    // Check if any developer exists
    const developerExists = await prisma.adminUser.findFirst({ where: { role: "developer" } });

    if (developerExists) {
      // Subsequent registrations need a valid invite token
      const storedTokenRaw = await prisma.appSetting.findUnique({ where: { key: "invite_token" } });
      if (!storedTokenRaw) {
        return NextResponse.json({ error: "Invite token tidak valid atau sudah kadaluarsa" }, { status: 403 });
      }
      const stored = JSON.parse(storedTokenRaw.value) as { token: string; expiresAt: string };
      if (stored.token !== inviteToken || new Date(stored.expiresAt) < new Date()) {
        return NextResponse.json({ error: "Invite token tidak valid atau sudah kadaluarsa" }, { status: 403 });
      }
      // Consume the token
      await prisma.appSetting.delete({ where: { key: "invite_token" } });
    }

    // Check email unique
    const existingUser = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const isFirstUser = !developerExists;

    const user = await prisma.adminUser.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password: hashed,
        role: isFirstUser ? "developer" : "admin",
        status: isFirstUser ? "active" : "inactive",
        permissions: isFirstUser ? undefined : DEFAULT_ADMIN_PERMISSIONS,
      },
    });

    return NextResponse.json({
      success: true,
      message: isFirstUser
        ? "Akun Developer berhasil dibuat! Silakan login."
        : "Registrasi berhasil! Akun Anda perlu diaktifkan oleh Developer.",
      role: user.role,
    }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
