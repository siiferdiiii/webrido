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

    // Fetch semua user berdasarkan filter tanpa paginasi (untuk export follow-up)
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

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { whatsapp: { contains: search } },
      ];
    }

    if (status === "active") where.subscriptionStatus = "active";
    if (status === "inactive") where.subscriptionStatus = "inactive";

    if (followUp && followUp !== "none" && followUp !== "all") {
      where.followUpStatus = followUp;
    }

    // Tentukan order by awal untuk Prisma
    let orderBy: any = { createdAt: "desc" };

    if (sortBy === "total_trx_desc") {
      orderBy = { transactions: { _count: "desc" } };
    } else if (sortBy === "total_trx_asc") {
      orderBy = { transactions: { _count: "asc" } };
    } else if (sortBy === "terlama") {
      orderBy = { createdAt: "asc" };
    }

    // Jika allUsers=1, ambil semua tanpa paginasi (hanya field yang diperlukan untuk follow-up)
    if (allUsers) {
      const users = await prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, whatsapp: true },
        orderBy,
      });
      return NextResponse.json({ users, total: users.length });
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          transactions: {
            orderBy: { purchaseDate: "desc" },
            take: 1,
            select: { purchaseDate: true, warrantyExpiredAt: true },
          },
          _count: { select: { transactions: true } },
        },
        orderBy,
        skip: (sortBy === "last_trx_desc" || sortBy === "last_trx_asc") ? undefined : skip,
        take: (sortBy === "last_trx_desc" || sortBy === "last_trx_asc") ? undefined : limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Jika sorting by last transaction date, terpaksa lakukan manual di memory karena Prisma
    // tidak support orderBy dari tabel relasi array hasMany() secara langsung
    let finalUsers = users;

    if (sortBy === "last_trx_desc" || sortBy === "last_trx_asc") {
      finalUsers.sort((a, b) => {
        const dateA = a.transactions[0]?.purchaseDate ? new Date(a.transactions[0].purchaseDate).getTime() : 0;
        const dateB = b.transactions[0]?.purchaseDate ? new Date(b.transactions[0].purchaseDate).getTime() : 0;

        return sortBy === "last_trx_desc" ? dateB - dateA : dateA - dateB;
      });
      // Paginasi manual
      finalUsers = finalUsers.slice(skip, skip + limit);
    }

    return NextResponse.json({ users: finalUsers, total, page, limit });
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
