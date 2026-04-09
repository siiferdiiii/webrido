import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/users - Ambil semua user dengan filter
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const followUp = searchParams.get("followUp") || "";
    const sortBy = searchParams.get("sortBy") || "terbaru";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Fetch semua user tanpa paginasi (untuk export follow-up)
    const allUsers = searchParams.get("allUsers") === "1";

    // Fetch user spesifik berdasarkan IDs
    const idsParam = searchParams.get("ids") || "";
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true, whatsapp: true },
      });
      return NextResponse.json({ users, total: users.length });
    }

    // ── Advanced filter params ──────────────────────────────────────────────
    const tagIds = (searchParams.get("tagIds") || "").split(",").filter(Boolean);
    // Backward compat: single tagId param
    const tagIdSingle = searchParams.get("tagId") || "";
    if (tagIdSingle && !tagIds.includes(tagIdSingle)) tagIds.push(tagIdSingle);

    const lastTrxFrom = searchParams.get("lastTrxFrom") || ""; // YYYY-MM-DD
    const lastTrxTo = searchParams.get("lastTrxTo") || "";     // YYYY-MM-DD
    const minTrx = parseInt(searchParams.get("minTrx") || "") || 0;
    const maxTrx = parseInt(searchParams.get("maxTrx") || "") || 0;

    // Count-based filters require in-memory filtering (Prisma doesn't support _count in WHERE)
    const needsInMemory = minTrx > 0 || maxTrx > 0;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { whatsapp: { contains: search } },
      ];
    }

    // ── Status filter (dynamic active days from settings) ─────────────────────
    const settingDays = await prisma.appSetting.findUnique({ where: { key: "customer_active_days" } });
    const activeDays = Math.max(1, parseInt(settingDays?.value || "60") || 60);
    const cutoffDate = new Date(Date.now() - activeDays * 24 * 60 * 60 * 1000);
    if (status === "active") {
      where.transactions = {
        some: { status: "success", purchaseDate: { gte: cutoffDate } },
      };
    } else if (status === "inactive") {
      where.transactions = {
        none: { status: "success", purchaseDate: { gte: cutoffDate } },
      };
    }

    if (followUp && followUp !== "none" && followUp !== "all") {
      where.followUpStatus = followUp;
    }

    // ── Multi-tag filter ──────────────────────────────────────────────────────
    if (tagIds.length > 0) {
      where.tags = { some: { tagId: { in: tagIds } } };
    }

    // ── Last transaction date range ───────────────────────────────────────────
    // Filter users whose LAST SUCCESS transaction date is in [from, to].
    //
    // IMPORTANT: Lynk.id CSV dates are imported WITHOUT timezone conversion
    // (e.g., "09/04/2026 18:00 WIB" is stored as 2026-04-09T18:00:00Z — treating
    // WIB time as UTC). Therefore we use UTC midnight boundaries to stay consistent
    // with how dates are actually stored in the DB.
    if (lastTrxFrom || lastTrxTo) {
      const andConditions: Record<string, unknown>[] = [];
      if (lastTrxFrom) {
        // Start of day UTC (e.g. "2026-04-09" → 2026-04-09T00:00:00Z)
        const from = new Date(lastTrxFrom + "T00:00:00Z");
        andConditions.push({
          transactions: { some: { status: "success", purchaseDate: { gte: from } } },
        });
      }
      if (lastTrxTo) {
        // Start of NEXT day UTC (exclusive upper bound — avoids second-precision issues)
        const nextDay = new Date(lastTrxTo + "T00:00:00Z");
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        andConditions.push({
          transactions: { none: { status: "success", purchaseDate: { gte: nextDay } } },
        });
      }
      if (andConditions.length > 0) {
        where.AND = andConditions;
      }
    }


    // ── Order by ─────────────────────────────────────────────────────────────
    let orderBy: Record<string, unknown> | Record<string, unknown>[] = { createdAt: "desc" };
    if (sortBy === "total_trx_desc") orderBy = { transactions: { _count: "desc" } };
    else if (sortBy === "total_trx_asc") orderBy = { transactions: { _count: "asc" } };
    else if (sortBy === "terlama") orderBy = { createdAt: "asc" };

    const needsManualPagination =
      sortBy === "last_trx_desc" || sortBy === "last_trx_asc" || needsInMemory;

    // ── allUsers mode: no pagination ──────────────────────────────────────────
    if (allUsers) {
      const users = await prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, whatsapp: true },
        orderBy,
      });
      return NextResponse.json({ users, total: users.length });
    }

    // ── Fetch data ────────────────────────────────────────────────────────────
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          transactions: {
            where: { status: "success" }, // hanya transaksi sukses untuk Pembelian Terakhir
            orderBy: { purchaseDate: "desc" },
            take: 1,
            select: { purchaseDate: true, warrantyExpiredAt: true },
          },
          _count: { select: { transactions: true } },
          tags: { include: { tag: true }, orderBy: { assignedAt: "asc" } },
        },
        orderBy,
        skip: needsManualPagination ? undefined : skip,
        take: needsManualPagination ? undefined : limit,
      }),
      prisma.user.count({ where }),
    ]);

    // ── In-memory filtering & sorting ─────────────────────────────────────────
    let finalUsers = users;

    // Filter by transaction count
    if (needsInMemory) {
      finalUsers = finalUsers.filter((u) => {
        const count = u._count.transactions;
        if (minTrx > 0 && count < minTrx) return false;
        if (maxTrx > 0 && count > maxTrx) return false;
        return true;
      });
    }

    // Sort by last transaction date
    if (sortBy === "last_trx_desc" || sortBy === "last_trx_asc") {
      finalUsers.sort((a, b) => {
        const dateA = a.transactions[0]?.purchaseDate ? new Date(a.transactions[0].purchaseDate).getTime() : 0;
        const dateB = b.transactions[0]?.purchaseDate ? new Date(b.transactions[0].purchaseDate).getTime() : 0;
        return sortBy === "last_trx_desc" ? dateB - dateA : dateA - dateB;
      });
    }

    // Manual pagination
    if (needsManualPagination) {
      finalUsers = finalUsers.slice(skip, skip + limit);
    }

    // Effective total (accounting for in-memory count filter)
    const effectiveTotal = needsInMemory
      ? users.filter((u) => {
          const count = u._count.transactions;
          if (minTrx > 0 && count < minTrx) return false;
          if (maxTrx > 0 && count > maxTrx) return false;
          return true;
        }).length
      : total;

    return NextResponse.json({ users: finalUsers, total: effectiveTotal, page, limit, activeDays });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Gagal mengambil data user" }, { status: 500 });
  }
}


// POST /api/users - Tambah user baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, whatsapp, notes } = body;

    if (!email || !name) {
      return NextResponse.json({ error: "Email dan nama wajib diisi" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: { email, name, whatsapp, notes },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Gagal membuat user" }, { status: 500 });
  }
}
