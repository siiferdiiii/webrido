import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("page_retention");
  if ("error" in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    
    // Default: Periode A = Bulan Lalu, Periode B = Bulan Ini
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const startAStr = searchParams.get("startA");
    const endAStr = searchParams.get("endA");
    const startBStr = searchParams.get("startB");
    const endBStr = searchParams.get("endB");

    const startDateA = startAStr ? new Date(startAStr) : firstDayLastMonth;
    const endDateA = endAStr ? new Date(endAStr) : lastDayLastMonth;
    const startDateB = startBStr ? new Date(startBStr) : firstDayThisMonth;
    const endDateB = endBStr ? new Date(endBStr) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Filter opsional: tagId
    const tagId = searchParams.get("tagId") || "";

    // Filter transaksi sukses di Periode A (+ filter tag jika ada)
    const transactionsA = await prisma.transaction.findMany({
      where: {
        status: "success",
        purchaseDate: { gte: startDateA, lte: endDateA },
        ...(tagId ? { user: { tags: { some: { tagId } } } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsapp: true,
            tags: {
              include: { tag: true },
              orderBy: { assignedAt: "asc" },
            },
          },
        },
      },
      orderBy: { purchaseDate: "asc" }
    });

    // Map user unik di Periode A
    const userMap = new Map();
    transactionsA.forEach(t => {
      if (!t.user) return;
      if (!userMap.has(t.user.id)) {
        userMap.set(t.user.id, {
          id: t.user.id,
          name: t.user.name,
          email: t.user.email,
          whatsapp: t.user.whatsapp,
          tags: t.user.tags ?? [],
          periodATransactions: 0,
          periodAAmount: 0,
          periodBTransactions: 0,
          periodBAmount: 0,
          status: "churned" // Default belum repeat
        });
      }
      const u = userMap.get(t.user.id);
      u.periodATransactions += 1;
      u.periodAAmount += Number(t.amount);
    });

    const userIdsA = Array.from(userMap.keys());

    // Cek transaksi user-user tersebut di Periode B
    if (userIdsA.length > 0) {
      const transactionsB = await prisma.transaction.findMany({
        where: {
          status: "success",
          purchaseDate: { gte: startDateB, lte: endDateB },
          userId: { in: userIdsA }
        }
      });

      transactionsB.forEach(t => {
        const u = userMap.get(t.userId);
        if (u) {
          u.periodBTransactions += 1;
          u.periodBAmount += Number(t.amount);
          u.status = "retained"; // Sudah repeat
        }
      });
    }

    const customers = Array.from(userMap.values());
    const totalPeriodA = customers.length;
    const retained = customers.filter(c => c.status === "retained").length;
    const churned = totalPeriodA - retained;
    const retentionRate = totalPeriodA > 0 ? Math.round((retained / totalPeriodA) * 100) : 0;

    return NextResponse.json({
      success: true,
      summary: { totalPeriodA, retained, churned, retentionRate },
      period: {
        a: { start: startDateA, end: endDateA },
        b: { start: startDateB, end: endDateB }
      },
      customers
    });
  } catch (error: any) {
    console.error("Error fetching retention data:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
