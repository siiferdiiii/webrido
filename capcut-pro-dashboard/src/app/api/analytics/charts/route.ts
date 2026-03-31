import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/analytics/charts?range=3m
// range: 1m | 3m | 6m | 1y
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "3m";

    // Hitung tanggal awal berdasarkan range
    const now = new Date();
    const startDate = new Date(now);

    switch (range) {
      case "1m": startDate.setMonth(now.getMonth() - 1); break;
      case "6m": startDate.setMonth(now.getMonth() - 6); break;
      case "1y": startDate.setFullYear(now.getFullYear() - 1); break;
      default:   startDate.setMonth(now.getMonth() - 3); break; // 3m default
    }
    startDate.setHours(0, 0, 0, 0);

    // Ambil semua transaksi dalam range (hanya success)
    const transactions = await prisma.transaction.findMany({
      where: {
        purchaseDate: { gte: startDate },
        status: "success",
      },
      select: {
        purchaseDate: true,
        amount: true,
      },
      orderBy: { purchaseDate: "asc" },
    });

    // Ambil semua user yang dibuat dalam range
    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Tentukan granularity: daily untuk ≤3m, weekly untuk >3m
    const useWeekly = range === "6m" || range === "1y";

    // Fungsi untuk get group key
    const getKey = (date: Date): string => {
      if (useWeekly) {
        // Minggu ke-N bulan tertentu
        const d = new Date(date);
        // Round ke awal minggu (Senin)
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        d.setDate(d.getDate() + diff);
        return d.toISOString().slice(0, 10);
      }
      return date.toISOString().slice(0, 10);
    };

    // Label display
    const getLabel = (key: string): string => {
      const d = new Date(key + "T00:00:00");
      if (useWeekly) {
        return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      }
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    };

    // Build date map dari startDate s/d now
    const dateMap = new Map<string, { penjualan: number; omset: number; newUser: number }>();

    // Generate semua keys dalam range
    const cursor = new Date(startDate);
    while (cursor <= now) {
      const key = getKey(cursor);
      if (!dateMap.has(key)) {
        dateMap.set(key, { penjualan: 0, omset: 0, newUser: 0 });
      }
      if (useWeekly) {
        cursor.setDate(cursor.getDate() + 7);
      } else {
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Aggregate transaksi
    for (const trx of transactions) {
      if (!trx.purchaseDate) continue;
      const key = getKey(new Date(trx.purchaseDate));
      const entry = dateMap.get(key);
      if (entry) {
        entry.penjualan += 1;
        entry.omset += Number(trx.amount);
      }
    }

    // Aggregate users baru
    for (const user of users) {
      if (!user.createdAt) continue;
      const key = getKey(new Date(user.createdAt));
      const entry = dateMap.get(key);
      if (entry) {
        entry.newUser += 1;
      }
    }

    // Convert to array sorted by date
    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        date: key,
        label: getLabel(key),
        penjualan: val.penjualan,
        omset: val.omset,
        newUser: val.newUser,
      }));

    // Summary stats untuk comparison
    const totalPenjualan = chartData.reduce((s, d) => s + d.penjualan, 0);
    const totalOmset = chartData.reduce((s, d) => s + d.omset, 0);
    const totalNewUser = chartData.reduce((s, d) => s + d.newUser, 0);

    return NextResponse.json({
      chartData,
      summary: { totalPenjualan, totalOmset, totalNewUser },
      range,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/analytics/charts error:", error);
    return NextResponse.json({ error: "Gagal mengambil data chart" }, { status: 500 });
  }
}
