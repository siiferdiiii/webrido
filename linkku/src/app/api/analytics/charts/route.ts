import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/analytics/charts?range=3m
// range: 1m | 3m | 6m | 1y
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "3m";

    const now = new Date();
    const startDate = new Date(now);

    switch (range) {
      case "1m": startDate.setMonth(now.getMonth() - 1); break;
      case "6m": startDate.setMonth(now.getMonth() - 6); break;
      case "1y": startDate.setFullYear(now.getFullYear() - 1); break;
      default:   startDate.setMonth(now.getMonth() - 3); break;
    }
    startDate.setHours(0, 0, 0, 0);

    const useWeekly = range === "6m" || range === "1y";

    // ── Transaksi sukses dalam range ─────────────────────────────────────────
    const transactions = await prisma.transaction.findMany({
      where: { purchaseDate: { gte: startDate }, status: "success" },
      select: { purchaseDate: true, amount: true },
      orderBy: { purchaseDate: "asc" },
    });

    // ── User baru = berdasarkan tanggal transaksi PERTAMA mereka (bukan createdAt) ──
    // Karena import massal akan set createdAt = hari ini untuk semua user lama
    const firstTrxPerUser = await prisma.transaction.groupBy({
      by: ["userId"],
      where: { status: "success", userId: { not: null } },
      _min: { purchaseDate: true },
    });

    const newUsersInRange: Date[] = [];
    for (const row of firstTrxPerUser) {
      const d = row._min.purchaseDate;
      if (d && d >= startDate && d <= now) {
        newUsersInRange.push(d);
      }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const getWeekStart = (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const getKey = (date: Date): string => {
      if (useWeekly) return getWeekStart(date).toISOString().slice(0, 10);
      return date.toISOString().slice(0, 10);
    };

    // Label pendek untuk sumbu X
    const getLabel = (key: string): string => {
      const d = new Date(key + "T00:00:00");
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    };

    // Label lengkap periode untuk tooltip (misal "1 Mar – 7 Mar")
    const getPeriodLabel = (key: string): string => {
      const d = new Date(key + "T00:00:00");
      if (useWeekly) {
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const fmt = (dt: Date) =>
          dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        return `${fmt(d)} – ${fmt(end)}`;
      }
      return d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };

    // ── Build date map ────────────────────────────────────────────────────────
    const dateMap = new Map<string, { penjualan: number; omset: number; newUser: number }>();
    const cursor = new Date(startDate);
    while (cursor <= now) {
      const key = getKey(cursor);
      if (!dateMap.has(key)) dateMap.set(key, { penjualan: 0, omset: 0, newUser: 0 });
      cursor.setDate(cursor.getDate() + (useWeekly ? 7 : 1));
    }

    // ── Aggregate transaksi ───────────────────────────────────────────────────
    for (const trx of transactions) {
      if (!trx.purchaseDate) continue;
      const entry = dateMap.get(getKey(new Date(trx.purchaseDate)));
      if (entry) { entry.penjualan += 1; entry.omset += Number(trx.amount); }
    }

    // ── Aggregate user baru ───────────────────────────────────────────────────
    for (const d of newUsersInRange) {
      const entry = dateMap.get(getKey(d));
      if (entry) entry.newUser += 1;
    }

    // ── Build final array ─────────────────────────────────────────────────────
    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        date: key,
        label: getLabel(key),
        periodLabel: getPeriodLabel(key),
        ...val,
      }));

    return NextResponse.json({
      chartData,
      summary: {
        totalPenjualan: chartData.reduce((s, d) => s + d.penjualan, 0),
        totalOmset: chartData.reduce((s, d) => s + d.omset, 0),
        totalNewUser: chartData.reduce((s, d) => s + d.newUser, 0),
      },
      range,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/analytics/charts error:", error);
    return NextResponse.json({ error: "Gagal mengambil data chart" }, { status: 500 });
  }
}
