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

    // ── Helper: hitung status "efektif" (override in_use → full jika slot penuh) ──
    function effectiveStatus(acc: { status: string | null; usedSlots: number | null; maxSlots: number | null }, defaultMax: number) {
      const used = acc.usedSlots ?? 0;
      const max = acc.maxSlots ?? defaultMax;
      if (acc.status === "in_use" && used >= max) return "full_stale"; // data stale di DB
      return acc.status ?? "unknown";
    }

    // ── Auto-fix background: update status akun yang stale (in_use tapi slot penuh) ──
    const staleMobileIds = allMobileRaw
      .filter(a => a.status === "in_use" && (a.usedSlots ?? 0) >= (a.maxSlots ?? 3))
      .map(a => a.id);
    const staleDesktopIds = allDesktopRaw
      .filter(a => a.status === "in_use" && (a.usedSlots ?? 0) >= (a.maxSlots ?? 2))
      .map(a => a.id);
    const staleIds = [...staleMobileIds, ...staleDesktopIds];
    if (staleIds.length > 0) {
      // Fire-and-forget: jangan await agar tidak lambat response
      prisma.stockAccount.updateMany({
        where: { id: { in: staleIds } },
        data: { status: "full" },
      }).catch(e => console.error("[stock] auto-fix stale status error:", e));
    }

    // ── Hitung stats Mobile (akurat berdasarkan usedSlots vs maxSlots) ──────
    const mobileStatusCounts: Record<string, number> = { available: 0, sold: 0 };
    for (const acc of allMobileRaw) {
      const eff = effectiveStatus(acc, 3);
      if (eff === "available") mobileStatusCounts.available++;
      else mobileStatusCounts.sold++; // in_use, sold, full, full_stale, banned, expired
    }
    const mobileTotal = allMobileRaw.length;

    // ── Hitung stats Desktop (akurat berdasarkan usedSlots vs maxSlots) ─────
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

    // ── Sisa slot (hanya dari akun yang benar-benar masih ada kapasitas) ─────
    const remainingSlotsMobile = allMobileRaw.reduce((sum, acc) => {
      return sum + Math.max(0, (acc.maxSlots ?? 3) - (acc.usedSlots ?? 0));
    }, 0);
    const remainingSlotsDesktop = allDesktopRaw.reduce((sum, acc) => {
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
