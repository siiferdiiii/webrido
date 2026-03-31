import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/warranty - Ambil semua klaim garansi
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { transaction: { user: { name: { contains: search, mode: "insensitive" } } } },
        { transaction: { user: { whatsapp: { contains: search } } } },
        { transaction: { lynkIdRef: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [claims, total] = await Promise.all([
      prisma.warrantyClaim.findMany({
        where,
        include: {
          transaction: {
            include: { user: { select: { name: true, whatsapp: true } } },
          },
          oldAccount: { select: { accountEmail: true } },
          newAccount: { select: { accountEmail: true, accountPassword: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.warrantyClaim.count({ where }),
    ]);

    return NextResponse.json({ claims, total, page, limit });
  } catch (error) {
    console.error("GET /api/warranty error:", error);
    return NextResponse.json({ error: "Gagal mengambil data klaim" }, { status: 500 });
  }
}

// POST /api/warranty - Proses klaim garansi baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactionId, claimReason } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "ID transaksi wajib diisi" }, { status: 400 });
    }

    // 1. Ambil transaksi dan akun lama
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { stockAccount: true, user: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // 2. Tentukan productType dari akun lama agar akun pengganti sesuai tipe produk
    const oldProductType = transaction.stockAccount?.productType ?? "mobile";
    const defaultMaxSlots = oldProductType === "desktop" ? 2 : 3;

    // Cari akun baru yang tersedia dengan productType yang SAMA
    const candidateAccounts = await prisma.stockAccount.findMany({
      where: {
        status: { in: ["available", "in_use"] },
        productType: oldProductType,
      },
      orderBy: { createdAt: "asc" },
    });

    const newAccount = candidateAccounts.find(acc =>
      acc.status === "available" ||
      (acc.status === "in_use" && (acc.usedSlots ?? 0) < (acc.maxSlots ?? defaultMaxSlots))
    ) ?? null;

    if (!newAccount) {
      return NextResponse.json({ error: `Stok akun ${oldProductType} habis! Semua akun ${oldProductType} sudah penuh.` }, { status: 400 });
    }

    // 3. Buat klaim garansi
    const claim = await prisma.warrantyClaim.create({
      data: {
        transactionId,
        oldAccountId: transaction.stockAccountId,
        newAccountId: newAccount.id,
        claimReason: claimReason || "Tidak disebutkan",
        status: "resolved",
      },
      include: {
        oldAccount: true,
        newAccount: true,
      },
    });

    // 4. Update akun lama: kurangi slot, jangan ban jika masih ada sisa slot
    if (transaction.stockAccountId) {
      const oldAccount = transaction.stockAccount;
      const currentUsedSlots = oldAccount?.usedSlots ?? 1;
      const oldMaxSlots = oldAccount?.maxSlots ?? defaultMaxSlots;
      const newUsedSlotsOld = Math.max(0, currentUsedSlots - 1);

      // Status: jika masih ada slot yang terpakai → in_use, jika kosong → available
      // Tidak pernah auto-banned hanya karena klaim garansi
      const oldAccountStatus = newUsedSlotsOld > 0 ? "in_use" : "available";

      await prisma.stockAccount.update({
        where: { id: transaction.stockAccountId },
        data: {
          status: oldAccountStatus,
          usedSlots: newUsedSlotsOld,
          notes: `Klaim garansi: sisa ${newUsedSlotsOld}/${oldMaxSlots} slot. ${claimReason || ""}`.trim(),
        },
      });
    }

    // Set akun baru ke in_use dan increment slot
    const newUsedSlots = (newAccount.usedSlots ?? 0) + 1;
    const newMaxSlots = newAccount.maxSlots ?? defaultMaxSlots;
    await prisma.stockAccount.update({
      where: { id: newAccount.id },
      data: {
        status: newUsedSlots >= newMaxSlots ? "in_use" : "in_use",
        usedSlots: { increment: 1 },
      },
    });

    // 5. Update transaksi ke akun baru
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { stockAccountId: newAccount.id },
    });

    return NextResponse.json({
      claim,
      newAccount: {
        email: newAccount.accountEmail,
        password: newAccount.accountPassword,
      },
      message: "Klaim garansi berhasil! Akun baru sudah siap dikirim.",
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/warranty error:", error);
    return NextResponse.json({ error: "Gagal memproses klaim garansi" }, { status: 500 });
  }
}
