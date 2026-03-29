import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// GET /api/stats - Statistik untuk halaman Dashboard Overview
export async function GET() {
  try {
    const [
      totalTransactions,
      totalUsers,
      availableStock,
      activeUsers,
      recentTransactions,
      expiringUsers,
    ] = await Promise.all([
      prisma.transaction.count(),
      prisma.user.count(),
      prisma.stockAccount.count({ where: { status: "available" } }),
      prisma.user.count({ where: { subscriptionStatus: "active" } }),

      // 5 transaksi terbaru
      prisma.transaction.findMany({
        include: {
          user: { select: { name: true, email: true, whatsapp: true } },
        },
        orderBy: { purchaseDate: "desc" },
        take: 5,
      }),

      // User yang garansi segera expired (7 hari ke depan, timezone WIB UTC+7)
      prisma.transaction.findMany({
        where: {
          warrantyExpiredAt: {
            // Mulai dari awal hari ini (WIB = UTC+7, jadi kurangi 7 jam dari midnight lokal)
            gte: new Date(new Date().setHours(0, 0, 0, 0) - 7 * 60 * 60 * 1000),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          status: "success",
        },
        include: {
          user: { select: { name: true, whatsapp: true, followUpStatus: true } },
        },
        orderBy: { warrantyExpiredAt: "asc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      totalTransactions,
      totalUsers,
      availableStock,
      activeUsers,
      recentTransactions,
      expiringUsers,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json({ error: "Gagal mengambil statistik" }, { status: 500 });
  }
}
