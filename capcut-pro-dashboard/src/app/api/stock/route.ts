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

    const [accounts, total, stats] = await Promise.all([
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
    ]);

    const statusCounts: Record<string, number> = { available: 0, full: 0, banned: 0, expired: 0 };
    stats.forEach((s) => {
      if (s.status) statusCounts[s.status] = s._count;
    });

    return NextResponse.json({ accounts, total, page, limit, statusCounts });
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
