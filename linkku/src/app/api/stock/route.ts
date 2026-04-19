import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

// GET /api/stock - Ambil semua stok akun dengan filter
export async function GET(req: NextRequest) {
  const auth = await requirePermission("page_stock");
  if ("error" in auth) return auth.error;
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
    if (productType && productType !== "all") {
      if (productType === "mobile" || productType === "desktop") {
        try {
          const setting = await prisma.appSetting.findUnique({ where: { key: "products" } });
          const skus = [productType];
          if (setting && setting.value) {
            const products = JSON.parse(setting.value);
            products.forEach((p: any) => {
              if (p.type === productType) skus.push(p.id);
            });
          }
          where.productType = { in: skus };
        } catch (e) {
          where.productType = productType;
        }
      } else {
        where.productType = productType;
      }
    }
    // ── Fetch semua data yang diperlukan ─────────────────────────────────────
    const [accounts, total, allRawStats] = await Promise.all([
      prisma.stockAccount.findMany({
        where,
        include: {
          transactions: {
            select: {
              user: { select: { name: true, email: true, whatsapp: true } },
              amount: true,
              productName: true,
              purchaseDate: true,
              warrantyExpiredAt: true,
              status: true,
            },
            orderBy: { purchaseDate: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.stockAccount.count({ where }),
      // Semua akun yang sesuai filter (untuk stats akurat)
      prisma.stockAccount.findMany({
        where,
        select: { id: true, status: true, usedSlots: true, maxSlots: true },
      }),
    ]);

    // ── Helper: hitung status berdasarkan usedSlots vs maxSlots ──
    function effectiveStatus(acc: { status: string | null; usedSlots: number | null; maxSlots: number | null }, defaultMax: number) {
      const used = acc.usedSlots ?? 0;
      const max = acc.maxSlots ?? defaultMax;
      // Hanya 2 status: available (masih ada slot) atau sold (penuh)
      if (used < max) return "available";
      return "sold";
    }

    // ── Auto-fix background: update status akun yang stale (in_use tapi slot penuh) ──
    const staleIds = allRawStats
      .filter(a => a.status === "in_use" && (a.usedSlots ?? 0) >= (a.maxSlots ?? 3))
      .map(a => a.id);
      
    if (staleIds.length > 0) {
      // Fix akun yang harusnya available (masih ada slot kosong)
      const shouldBeAvailable = allRawStats
        .filter(a => staleIds.includes(a.id) && (a.usedSlots ?? 0) < (a.maxSlots ?? 3))
        .map(a => a.id);
      const shouldBeSold = staleIds.filter(id => !shouldBeAvailable.includes(id));

      if (shouldBeAvailable.length > 0) {
        prisma.stockAccount.updateMany({
          where: { id: { in: shouldBeAvailable } },
          data: { status: "available" },
        }).catch(e => console.error("[stock] auto-fix to available error:", e));
      }
      if (shouldBeSold.length > 0) {
        prisma.stockAccount.updateMany({
          where: { id: { in: shouldBeSold } },
          data: { status: "sold" },
        }).catch(e => console.error("[stock] auto-fix to sold error:", e));
      }
    }

    // ── Hitung stats Keseluruhan ──────────────────────────────────────────
    const statusCounts: Record<string, number> = { available: 0, sold: 0 };
    for (const acc of allRawStats) {
      const eff = effectiveStatus(acc, acc.maxSlots ?? 3);
      if (eff === "available") statusCounts.available++;
      else statusCounts.sold++; // sold, full, full_stale, banned, expired
    }

    // ── Sisa slot (hanya dari akun yang benar-benar masih ada kapasitas) ─────
    const remainingSlots = allRawStats.reduce((sum, acc) => {
      return sum + Math.max(0, (acc.maxSlots ?? 3) - (acc.usedSlots ?? 0));
    }, 0);

    return NextResponse.json({
      accounts, total, page, limit,
      statusCounts,
      remainingSlots,
    });
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
