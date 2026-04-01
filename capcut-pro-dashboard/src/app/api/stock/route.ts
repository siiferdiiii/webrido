import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/stock - Ambil semua stok akun dengan filter
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const productType = searchParams.get("productType") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { accountEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "all") where.status = status;
    if (productType && productType !== "all") where.productType = productType;

    const [accounts, total, stats, mobileAccounts, desktopAccounts] = await Promise.all([
      prisma.stockAccount.findMany({
        where,
        include: {
          transactions: {
            select: { user: { select: { name: true, email: true } } },
            orderBy: { purchaseDate: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockAccount.count({ where }),
      prisma.stockAccount.groupBy({
        by: ["status"],
        _count: true,
      }),
      // Sisa slot akun mobile (available + in_use yang belum penuh)
      prisma.stockAccount.findMany({
        where: { productType: "mobile", status: { in: ["available", "in_use"] } },
        select: { maxSlots: true, usedSlots: true },
      }),
      // Sisa slot akun desktop (available + in_use yang belum penuh)
      prisma.stockAccount.findMany({
        where: { productType: "desktop", status: { in: ["available", "in_use"] } },
        select: { maxSlots: true, usedSlots: true },
      }),
    ]);

    const statusCounts: Record<string, number> = { available: 0, in_use: 0, sold: 0 };
    stats.forEach((s) => {
      if (s.status === "available") statusCounts.available = s._count;
      else if (s.status === "in_use") statusCounts.in_use = s._count;
      else if (s.status === "sold" || s.status === "full") statusCounts.sold = (statusCounts.sold || 0) + s._count;
    });

    // Hitung total sisa slot kumulatif per tipe
    const remainingSlotsMobile = mobileAccounts.reduce((sum, acc) => {
      return sum + Math.max(0, (acc.maxSlots ?? 3) - (acc.usedSlots ?? 0));
    }, 0);
    const remainingSlotsDesktop = desktopAccounts.reduce((sum, acc) => {
      return sum + Math.max(0, (acc.maxSlots ?? 2) - (acc.usedSlots ?? 0));
    }, 0);

    return NextResponse.json({ accounts, total, page, limit, statusCounts, remainingSlotsMobile, remainingSlotsDesktop });
  } catch (error) {
    console.error("GET /api/stock error:", error);
    return NextResponse.json({ error: "Gagal mengambil stok akun" }, { status: 500 });
  }
}

// POST /api/stock - Tambah stok akun (single atau bulk) + tipe produk & slot
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accounts, durationDays = 30, productType = "mobile", maxSlots } = body;

    const slots = maxSlots || (productType === "desktop" ? 2 : 3);

    let data: { accountEmail: string; accountPassword: string; durationDays: number; productType: string; maxSlots: number; usedSlots: number }[];

    if (Array.isArray(accounts)) {
      data = accounts.map((acc: { email: string; password: string }) => ({
        accountEmail: acc.email,
        accountPassword: acc.password,
        durationDays,
        productType,
        maxSlots: slots,
        usedSlots: 0,
      }));
    } else if (body.email && body.password) {
      data = [{ accountEmail: body.email, accountPassword: body.password, durationDays, productType, maxSlots: slots, usedSlots: 0 }];
    } else {
      return NextResponse.json({ error: "Data akun tidak valid" }, { status: 400 });
    }

    const result = await prisma.stockAccount.createMany({ data });

    return NextResponse.json({ created: result.count }, { status: 201 });
  } catch (error) {
    console.error("POST /api/stock error:", error);
    return NextResponse.json({ error: "Gagal menambahkan stok" }, { status: 500 });
  }
}
