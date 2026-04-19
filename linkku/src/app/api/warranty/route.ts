import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";

const WARRANTY_WEBHOOK_URL =
  "https://appsheetindonesia-dorrizstore.qxifii.easypanel.host/webhook/25ef64ae-a473-4f33-9549-d4a86138d14e";

async function sendWarrantyWebhook(payload: {
  nama: string;
  email: string;
  no_hp: string;
  akun_email: string;
  akun_password: string;
  alasan_klaim: string;
  tanggal_klaim: string;
}) {
  try {
    await fetch(WARRANTY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[Warranty Webhook] Berhasil dikirim untuk:", payload.email);
  } catch (err) {
    console.error("[Warranty Webhook] Gagal mengirim webhook:", err);
  }
}

// GET /api/warranty - Ambil semua klaim garansi
export async function GET(req: NextRequest) {
  const auth = await requirePermission("page_warranty");
  if ("error" in auth) return auth.error;
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
            include: { 
              user: { select: { id: true, name: true, whatsapp: true } },
              warrantyClaims: { select: { id: true }, orderBy: { createdAt: "asc" } }
            },
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
  const auth = await requirePermission("page_warranty");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { transactionId, claimReason } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "ID transaksi wajib diisi" }, { status: 400 });
    }

    // 1. Ambil transaksi dan akun lama (include user dengan email)
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        stockAccount: true,
        user: { select: { name: true, email: true, whatsapp: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }


    // Cek jika ada klaim PENDING untuk transaksi yang sama
    const pendingClaim = await prisma.warrantyClaim.findFirst({
      where: { transactionId, status: "pending" },
    });
    // Jika tidak pending, dan bukan request baru (misal via UI mungkin tidak tahu ini pending atau ga), 
    // tapi kalau sudah "resolved" biarkan bikin baru karena ini klaim garansi yang kesekian kalinya.

    // 2. Tentukan productType dari akun lama agar akun pengganti sesuai tipe produk
    const oldProductType = transaction.stockAccount?.productType ?? "mobile";
    const defaultMaxSlots = oldProductType === "desktop" ? 2 : 3;

    // Cari akun baru yang tersedia dengan productType yang SAMA
    // PENTING: exclude akun lama agar tidak reassign akun yang sama!
    const candidateAccounts = await prisma.stockAccount.findMany({
      where: {
        status: { in: ["available", "in_use"] },
        productType: oldProductType,
        ...(transaction.stockAccountId ? { id: { not: transaction.stockAccountId } } : {}),
      },
      orderBy: [{ usedSlots: "asc" }, { createdAt: "asc" }],
    });

    const newAccount = candidateAccounts.find(acc =>
      (acc.usedSlots ?? 0) < (acc.maxSlots ?? defaultMaxSlots)
    ) ?? null;

    if (!newAccount) {
      return NextResponse.json({ error: `Stok akun ${oldProductType} habis! Semua akun ${oldProductType} sudah penuh.` }, { status: 400 });
    }

    // 3. Buat atau Update klaim garansi (jika ada pending, update; jika tidak, buat baru)
    const claimData = {
      transactionId,
      oldAccountId: transaction.stockAccountId,
      newAccountId: newAccount.id,
      claimReason: pendingClaim?.claimReason || claimReason || "Tidak disebutkan",
      status: "resolved",
    };

    let claim;
    if (pendingClaim) {
      claim = await prisma.warrantyClaim.update({
        where: { id: pendingClaim.id },
        data: claimData,
        include: { oldAccount: true, newAccount: true },
      });
    } else {
      claim = await prisma.warrantyClaim.create({
        data: claimData,
        include: { oldAccount: true, newAccount: true },
      });
    }

    // 4. Update akun lama: kurangi slot, jangan ban jika masih ada sisa slot
    if (transaction.stockAccountId) {
      const oldAccount = transaction.stockAccount;
      const currentUsedSlots = oldAccount?.usedSlots ?? 1;
      const oldMaxSlots = oldAccount?.maxSlots ?? defaultMaxSlots;
      const newUsedSlotsOld = Math.max(0, currentUsedSlots - 1);

      // Status: selalu available jika masih ada slot kosong
      const oldAccountStatus = "available";

      await prisma.stockAccount.update({
        where: { id: transaction.stockAccountId },
        data: {
          status: oldAccountStatus,
          usedSlots: newUsedSlotsOld,
          notes: `Klaim garansi: sisa ${newUsedSlotsOld}/${oldMaxSlots} slot. ${claimReason || ""}`.trim(),
        },
      });
    }

    // Update slot akun baru: sold jika penuh, available jika masih ada sisa
    const newUsedSlots = (newAccount.usedSlots ?? 0) + 1;
    const newMaxSlots = newAccount.maxSlots ?? defaultMaxSlots;
    await prisma.stockAccount.update({
      where: { id: newAccount.id },
      data: {
        status: newUsedSlots >= newMaxSlots ? "sold" : "available",
        usedSlots: { increment: 1 },
      },
    });

    // 5. Update transaksi ke akun baru
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { stockAccountId: newAccount.id },
    });

    // 6. Kirim data ke webhook (fire-and-forget, tidak memblokir response)
    sendWarrantyWebhook({
      nama: transaction.user?.name ?? "-",
      email: transaction.user?.email ?? "-",
      no_hp: transaction.user?.whatsapp ?? "-",
      akun_email: newAccount.accountEmail,
      akun_password: newAccount.accountPassword,
      alasan_klaim: claimReason || "Tidak disebutkan",
      tanggal_klaim: new Date().toISOString(),
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
