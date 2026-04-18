import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/auth/me — get current user with permissions
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ user: null }, { status: 401 });

    const dbUser = await prisma.adminUser.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, role: true, status: true, permissions: true },
    });

    if (!dbUser || dbUser.status !== "active") {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user: dbUser });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
