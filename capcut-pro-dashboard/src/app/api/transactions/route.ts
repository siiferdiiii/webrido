import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

export const dynamic = 'force-dynamic';

// GET /api/transactions - Ambil semua transaksi
export async function GET(req: NextRequest) {
  const auth = await requirePermission("page_transactions");
  if ("error" in auth) return auth.error;
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      const searchConditions: Record<string, unknown>[] = [
        { lynkIdRef: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { whatsapp: { contains: search, mode: "insensitive" } } },
      ];
      // Also search by transaction UUID (id)
      // UUID format check - if search looks like a UUID prefix or full UUID
      if (/^[0-9a-f-]{4,}$/i.test(search)) {
        searchConditions.push({ id: { startsWith: search, mode: "insensitive" } });
      }
      where.OR = searchConditions;
    }

    if (status && status !== "all") {
      where.status = status;
    }

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const source = searchParams.get("source");

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
      where.purchaseDate = dateFilter;
    }

    if (source === "manual") {
      where.isManual = true;
    } else if (source === "lynkid") {
      where.isManual = false;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, whatsapp: true } },
          stockAccount: { select: { id: true, accountEmail: true, status: true } },
        },
        orderBy: { purchaseDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({ transactions, total, page, limit });
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json({ error: "Gagal mengambil data transaksi" }, { status: 500 });
  }
}

// POST /api/transactions - Tambah transaksi manual
export async function POST(req: NextRequest) {
  const auth = await requirePermission("page_transactions");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { email, name, whatsapp, amount, productName, durationDays = 30 } = body;

    if (!email || !name || !whatsapp) {
      return NextResponse.json({ error: "Email, nama, dan WhatsApp wajib diisi" }, { status: 400 });
    }

    // 1. Cari atau buat user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name, whatsapp },
      });
    } else {
      // Update user type ke returning
      await prisma.user.update({
        where: { id: user.id },
        data: {
          customerType: "returning",
          subscriptionStatus: "active",
          followUpStatus: "none",
          ...(whatsapp && { whatsapp }),
        },
      });
    }

    // 2. Cari stok akun yang available atau masih ada slot (round-robin: slot paling sedikit dulu)
    // Diurutkan usedSlots ASC supaya akun dengan slot paling sedikit dipilih duluan
    const candidateAccounts = await prisma.stockAccount.findMany({
      where: { status: { in: ["available", "in_use"] } },
      orderBy: [{ usedSlots: "asc" }, { createdAt: "asc" }],
    });

    // Filter di JS karena maxSlots beda tiap record
    const availableAccount = candidateAccounts.find(acc =>
      (acc.usedSlots ?? 0) < (acc.maxSlots ?? 3)
    ) ?? null;

    if (!availableAccount) {
      return NextResponse.json({ error: "Stok akun habis! Tidak ada akun tersedia." }, { status: 400 });
    }

    // 3. Hitung tanggal expired garansi
    const warrantyExpiredAt = new Date();
    warrantyExpiredAt.setDate(warrantyExpiredAt.getDate() + durationDays);

    // 4. Buat transaksi
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        stockAccountId: availableAccount.id,
        amount: amount || 0,
        productName: productName || null,
        status: "success",
        isManual: true,
        warrantyExpiredAt,
      },
      include: {
        user: true,
        stockAccount: true,
      },
    });

    // 5. Update status stok jadi in_use dan increment slot
    await prisma.stockAccount.update({
      where: { id: availableAccount.id },
      data: {
        status: "in_use",
        usedSlots: { increment: 1 },
      },
    });

    // 6. Update status user menjadi active
    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: "active", followUpStatus: "none" },
    });

    return NextResponse.json({
      transaction,
      account: {
        email: availableAccount.accountEmail,
        password: availableAccount.accountPassword,
      },
      message: "Transaksi berhasil! Kirim data akun ke pelanggan.",
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/transactions error:", error);
    return NextResponse.json({ error: "Gagal membuat transaksi" }, { status: 500 });
  }
}
