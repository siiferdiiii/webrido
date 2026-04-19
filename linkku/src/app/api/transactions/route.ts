import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { parseDuration, calcWarrantyExpiry } from "@/lib/duration";
import { parseProductType, resolveProductSku } from "@/lib/product";

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
    const warrantyStart = searchParams.get("warrantyStart");
    const warrantyEnd = searchParams.get("warrantyEnd");
    const source = searchParams.get("source");

    // Filter tanggal transaksi (purchaseDate)
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate)   dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
      where.purchaseDate = dateFilter;
    }

    // Filter tanggal garansi berakhir (warrantyExpiredAt)
    if (warrantyStart || warrantyEnd) {
      const warrantyFilter: Record<string, Date> = {};
      if (warrantyStart) warrantyFilter.gte = new Date(`${warrantyStart}T00:00:00.000Z`);
      if (warrantyEnd)   warrantyFilter.lte = new Date(`${warrantyEnd}T23:59:59.999Z`);
      where.warrantyExpiredAt = warrantyFilter;
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
    const { email, name, whatsapp, amount, productName, durationDays: rawDuration = 30 } = body;

    // Jika nama produk mengandung durasi (misal "1 bulan"), selalu pakai fix 30 hari
    // bukan durationDays dari stok yang bisa salah (mis. 31 hari di bulan Maret)
    const durationFromName = productName ? parseDuration(productName) : 0;
    const durationDays = durationFromName > 0 ? durationFromName : rawDuration;

    // FIX #4: Deteksi productType dari nama produk
    const { sku: detectedProductType } = await resolveProductSku(productName || "");

    if (!email || !name || !whatsapp) {
      return NextResponse.json({ error: "Email, nama, dan WhatsApp wajib diisi" }, { status: 400 });
    }

    // FIX #1: Wrap seluruh proses dalam prisma.$transaction (atomic)
    // Mencegah race condition: 2 request bersamaan tidak bisa ambil slot yang sama
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cari atau buat user
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: { email, name, whatsapp },
        });
      } else {
        // Update user type ke returning
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            customerType: "returning",
            subscriptionStatus: "active",
            followUpStatus: "none",
            ...(whatsapp && { whatsapp }),
          },
        });
      }

      // 2. FIX #4: Cari stok akun yang sesuai TIPE PRODUK, available atau masih ada slot
      // Diurutkan usedSlots ASC supaya akun dengan slot paling sedikit dipilih duluan (round-robin)
      const candidateAccounts = await tx.stockAccount.findMany({
        where: {
          status: { in: ["available", "in_use"] },
          productType: detectedProductType, // FIX #4: filter by productType
        },
        orderBy: [{ usedSlots: "asc" }, { createdAt: "asc" }],
      });

      // Filter di JS karena maxSlots beda tiap record
      const availableAccount = candidateAccounts.find(acc =>
        (acc.usedSlots ?? 0) < (acc.maxSlots ?? 3)
      ) ?? null;

      if (!availableAccount) {
        throw new Error(`STOK_HABIS:Stok akun ${detectedProductType} habis! Tidak ada akun tersedia.`);
      }

      // 3. Hitung tanggal expired garansi (fix days, bukan calendar month)
      const warrantyExpiredAt = calcWarrantyExpiry(new Date(), durationDays);
      const maxSlots = availableAccount.maxSlots ?? 3;
      const isVoucher = maxSlots === 1;

      // 4. Buat transaksi
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          stockAccountId: availableAccount.id,
          amount: amount || 0,
          productName: productName || null,
          status: "success",
          isManual: true,
          purchaseDate: new Date(),
          warrantyExpiredAt: isVoucher ? null : warrantyExpiredAt,
        },
        include: {
          user: true,
          stockAccount: true,
        },
      });

      // 5. FIX #1: Atomic update slot — updateMany dengan kondisi slot check
      // Jika ada race condition, updated.count akan 0 dan transaction akan di-rollback
      const newUsedSlots = (availableAccount.usedSlots ?? 0) + 1;
      const updated = await tx.stockAccount.updateMany({
        where: {
          id: availableAccount.id,
          usedSlots: { lt: maxSlots }, // Atomic guard: hanya update jika slot masih tersedia
        },
        data: {
          status: newUsedSlots >= maxSlots ? "sold" : "available",
          usedSlots: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new Error(`SLOT_PENUH:Slot akun sudah penuh (terjadi bersamaan). Silakan coba lagi.`);
      }

      // 6. Update status user menjadi active
      await tx.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "active", followUpStatus: "none" },
      });

      return { transaction, availableAccount };
    });

    return NextResponse.json({
      transaction: result.transaction,
      account: {
        email: result.availableAccount.accountEmail,
        password: result.availableAccount.accountPassword,
      },
      message: "Data transaksi berhasil ditambahkan, kirim data akun ke pelanggan?",
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Tangani error khusus dari dalam $transaction
    if (msg.startsWith("STOK_HABIS:")) {
      return NextResponse.json({ error: msg.replace("STOK_HABIS:", "") }, { status: 400 });
    }
    if (msg.startsWith("SLOT_PENUH:")) {
      return NextResponse.json({ error: msg.replace("SLOT_PENUH:", "") }, { status: 409 });
    }
    console.error("POST /api/transactions error:", error);
    return NextResponse.json({ error: "Gagal membuat transaksi" }, { status: 500 });
  }
}
