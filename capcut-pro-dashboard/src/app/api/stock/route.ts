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
    if (productType && productType !== "all") where.productType = productType;

    // ── Fetch semua data yang diperlukan ─────────────────────────────────────
    const [accounts, total, allMobileRaw, allDesktopRaw] = await Promise.all([
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
      // Semua akun mobile (untuk stats akurat)
      prisma.stockAccount.findMany({
        where: { productType: "mobile" },
        select: { id: true, status: true, usedSlots: true, maxSlots: true },
      }),
      // Semua akun desktop (untuk stats akurat)
      prisma.stockAccount.findMany({
        where: { productType: "desktop" },
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

    // ── Auto-fix background: update status akun yang stale (in_use/full → available/sold) ──
    const staleIds = [...allMobileRaw, ...allDesktopRaw]
      .filter(a => {
        const defaultMax = a.status === "desktop" ? 2 : 3;
        const used = a.usedSlots ?? 0;
        const max = a.maxSlots ?? defaultMax;
        const correctStatus = used < max ? "available" : "sold";
        return a.status !== correctStatus; // status di DB tidak sesuai
      })
      .map(a => a.id);

    if (staleIds.length > 0) {
      // Fix akun yang harusnya available (masih ada slot kosong)
      const shouldBeAvailable = [...allMobileRaw, ...allDesktopRaw]
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

    // ── Hitung stats Mobile (berdasarkan usedSlots vs maxSlots) ──────
    const mobileStatusCounts: Record<string, number> = { available: 0, sold: 0 };
    for (const acc of allMobileRaw) {
      const eff = effectiveStatus(acc, 3);
      if (eff === "available") mobileStatusCounts.available++;
      else mobileStatusCounts.sold++;
    }
    const mobileTotal = allMobileRaw.length;

    // ── Hitung stats Desktop (berdasarkan usedSlots vs maxSlots) ─────
    const desktopStatusCounts: Record<string, number> = { available: 0, sold: 0 };
    for (const acc of allDesktopRaw) {
      const eff = effectiveStatus(acc, 2);
      if (eff === "available") desktopStatusCounts.available++;
      else desktopStatusCounts.sold++;
    }
    const desktopTotal = allDesktopRaw.length;

    // ── Overall (gabungan) ────────────────────────────────────────────────────
    const statusCounts: Record<string, number> = {
      available: mobileStatusCounts.available + desktopStatusCounts.available,
      sold: mobileStatusCounts.sold + desktopStatusCounts.sold,
    };

    // ── Sisa slot (hanya dari akun yang status available) ─────────────────────
    const remainingSlotsMobile = allMobileRaw
      .filter(acc => effectiveStatus(acc, 3) === "available")
      .reduce((sum, acc) => {
        return sum + Math.max(0, (acc.maxSlots ?? 3) - (acc.usedSlots ?? 0));
      }, 0);
    const remainingSlotsDesktop = allDesktopRaw
      .filter(acc => effectiveStatus(acc, 2) === "available")
      .reduce((sum, acc) => {
        return sum + Math.max(0, (acc.maxSlots ?? 2) - (acc.usedSlots ?? 0));
      }, 0);

    return NextResponse.json({
      accounts, total, page, limit,
      statusCounts,
      mobileStatusCounts, mobileTotal,
      desktopStatusCounts, desktopTotal,
      remainingSlotsMobile, remainingSlotsDesktop,
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
