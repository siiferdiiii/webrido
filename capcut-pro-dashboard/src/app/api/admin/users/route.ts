import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireDeveloper, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// GET /api/admin/users — List all admin users (developer only)
export async function GET() {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const users = await prisma.adminUser.findMany({
      select: { id: true, email: true, name: true, role: true, status: true, permissions: true, createdAt: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/admin/users — Generate invite link (developer only)
export async function POST(req: NextRequest) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;

  try {
    const { action } = await req.json();

    if (action === "generate_invite") {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await prisma.appSetting.upsert({
        where: { key: "invite_token" },
        update: { value: JSON.stringify({ token, expiresAt: expiresAt.toISOString() }) },
        create: { key: "invite_token", value: JSON.stringify({ token, expiresAt: expiresAt.toISOString() }) },
      });

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const inviteLink = `${baseUrl}/register?token=${token}`;

      return NextResponse.json({ success: true, inviteLink, expiresAt });
    }

    if (action === "reset_permissions") {
      const { userId } = await req.json();
      await prisma.adminUser.update({
        where: { id: userId },
        data: { permissions: DEFAULT_ADMIN_PERMISSIONS },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
