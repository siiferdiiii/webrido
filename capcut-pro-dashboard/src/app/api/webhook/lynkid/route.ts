import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Mapping durasi berdasarkan kata kunci di judul produk Lynk.id
function parseDuration(title: string): number {
  const lower = title.toLowerCase();
  if (lower.includes("1 tahun") || lower.includes("12 bulan") || lower.includes("365")) return 365;
  if (lower.includes("6 bulan") || lower.includes("180")) return 180;
  if (lower.includes("3 bulan") || lower.includes("90")) return 90;
  if (lower.includes("2 bulan") || lower.includes("60")) return 60;
  if (lower.includes("1 bulan") || lower.includes("30")) return 30;
  if (lower.includes("1 minggu") || lower.includes("7 hari")) return 7;
  return 30;
}

// Deteksi tipe produk dari judul Lynk.id
function parseProductType(title: string): "mobile" | "desktop" {
  const lower = title.toLowerCase();
  if (lower.includes("laptop") || lower.includes("mac") || lower.includes("desktop") || lower.includes("pc")) {
    return "desktop";
  }
  return "mobile"; // HP/iPad/Tablet = default
}

// POST /api/webhook/lynkid - Menerima webhook dari n8n (Lynk.id payment)
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const data = Array.isArray(payload) ? payload[0] : payload;
    const body = data?.body || data;
    const event = body?.event;
    const messageData = body?.data?.message_data;
    const messageAction = body?.data?.message_action;

    // Validasi event
    if (event !== "payment.received" || messageAction !== "SUCCESS") {
      return NextResponse.json({
        success: false,
        message: `Event diabaikan: ${event} / ${messageAction}`,
      }, { status: 200 });
    }

    if (!messageData) {
      return NextResponse.json({ success: false, message: "Data pembayaran kosong" }, { status: 400 });
    }

    const customer = messageData.customer;
    if (!customer?.email || !customer?.name) {
      return NextResponse.json({ success: false, message: "Data customer tidak lengkap" }, { status: 400 });
    }

    const refId = messageData.refId;
    const items = messageData.items || [];
    const firstItem = items[0] || {};
    const productTitle = firstItem.title || "CapCut Pro";
    const price = messageData.totals?.grandTotal || firstItem.price || 0;
    const durationDays = parseDuration(productTitle);
    const productType = parseProductType(productTitle);
    const questions = firstItem.questions || "";

    // Data affiliate dari payload Lynk.id
    const affiliateEmail = messageData.affiliate_email || null;
    const affiliateCommissionAmount = messageData.totals?.affiliate
      ? Math.abs(Number(messageData.totals.affiliate))
      : 0;

    // Cek duplikat refId
    if (refId) {
      const existing = await prisma.transaction.findUnique({ where: { lynkIdRef: refId } });
      if (existing) {
        return NextResponse.json({
          success: false,
          message: `Transaksi dengan refId ${refId} sudah ada`,
          transactionId: existing.id,
        }, { status: 200 });
      }
    }

    // ===== 1. AFFILIATE: Cari/buat affiliate =====
    let affiliateId: string | null = null;
    if (affiliateEmail) {
      let affiliate = await prisma.affiliate.findUnique({ where: { email: affiliateEmail } });
      if (!affiliate) {
        // Auto-create affiliate dari webhook
        affiliate = await prisma.affiliate.create({
          data: {
            name: affiliateEmail.split("@")[0],
            email: affiliateEmail,
            commissionRate: 10.00,
          },
        });
      }
      affiliateId = affiliate.id;
    }

    // ===== 2. Cari atau buat user =====
    let user = await prisma.user.findUnique({ where: { email: customer.email } });
    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: customer.email,
          name: customer.name,
          whatsapp: customer.phone || null,
          customerType: "new",
          subscriptionStatus: "active",
          followUpStatus: "none",
          referredBy: affiliateId, // Simpan relasi affiliate saat user pertama kali beli
        },
      });
    } else {
      // Update data user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: customer.name,
          whatsapp: customer.phone || user.whatsapp,
          customerType: user.customerType === "new" ? "returning" : user.customerType,
          subscriptionStatus: "active",
          followUpStatus: "none",
          // referredBy hanya diset saat pertama kali (jika belum ada)
          ...(affiliateId && !user.referredBy ? { referredBy: affiliateId } : {}),
        },
      });
    }

    // ===== 3. SHARING ACCOUNT: Cari stok yang masih ada slot kosong =====
    // Round-robin: prioritaskan akun dengan usedSlots paling sedikit (distribusi merata)
    // Contoh: 3 akun → order1→Akun1-Slot1, order2→Akun2-Slot1, order3→Akun3-Slot1, order4→Akun1-Slot2, dst.
    const maxSlotsForType = productType === "desktop" ? 2 : 3;

    let account = await prisma.stockAccount.findFirst({
      where: {
        productType: productType,
        status: "available",
        usedSlots: { lt: maxSlotsForType },
        durationDays: durationDays,
      },
      orderBy: [
        { usedSlots: "asc" }, // Round-robin: isi akun dengan slot paling sedikit dulu
        { createdAt: "asc" },
      ],
    });

    // Fallback: cari stok tipe yang sama tanpa filter durasi
    if (!account) {
      account = await prisma.stockAccount.findFirst({
        where: {
          productType: productType,
          status: "available",
          usedSlots: { lt: maxSlotsForType },
        },
        orderBy: [{ usedSlots: "asc" }, { createdAt: "asc" }],
      });
    }

    // Fallback terakhir: tipe apapun
    if (!account) {
      account = await prisma.stockAccount.findFirst({
        where: { status: "available" },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!account) {
      await prisma.messageLog.create({
        data: {
          userId: user.id,
          whatsappNumber: customer.phone || "UNKNOWN",
          messageType: "stock_empty_alert",
          messageContent: `⚠️ STOK HABIS! Order: ${customer.name} (${customer.email}), produk: ${productTitle}. RefId: ${refId}`,
          status: "failed",
        },
      });
      return NextResponse.json({
        success: false,
        message: "STOK HABIS! Tidak ada akun tersedia.",
        customer: { name: customer.name, email: customer.email, phone: customer.phone },
      }, { status: 200 });
    }

    // ===== 4. Buat transaksi =====
    const purchaseDate = messageData.createdAt ? new Date(messageData.createdAt) : new Date();
    const warrantyExpiredAt = new Date(purchaseDate);
    warrantyExpiredAt.setDate(warrantyExpiredAt.getDate() + durationDays);

    const transaction = await prisma.transaction.create({
      data: {
        lynkIdRef: refId || null,
        userId: user.id,
        stockAccountId: account.id,
        amount: price,
        status: "success",
        isManual: false,
        purchaseDate,
        warrantyExpiredAt,
      },
    });

    // ===== 5. Update slot stok =====
    const newUsedSlots = (account.usedSlots || 0) + 1;
    const accountMaxSlots = account.maxSlots || maxSlotsForType;
    await prisma.stockAccount.update({
      where: { id: account.id },
      data: {
        usedSlots: newUsedSlots,
        status: newUsedSlots >= accountMaxSlots ? "full" : "available",
      },
    });

    // ===== 6. AFFILIATE KOMISI =====
    // Komisi diberikan jika: user punya referredBy affiliate (baik order pertama maupun repeat)
    const userAffiliateId = user.referredBy;
    let commissionInfo = null;

    if (userAffiliateId) {
      const affiliate = await prisma.affiliate.findUnique({ where: { id: userAffiliateId } });
      if (affiliate && affiliate.status === "active") {
        // Komisi: ambil dari payload Lynk.id jika ada, atau hitung dari commission_rate
        const commissionAmount = affiliateCommissionAmount > 0
          ? affiliateCommissionAmount
          : Math.round(price * Number(affiliate.commissionRate) / 100);

        await prisma.affiliateCommission.create({
          data: {
            affiliateId: userAffiliateId,
            transactionId: transaction.id,
            userId: user.id,
            amount: commissionAmount,
            transactionAmount: price,
          },
        });

        // Update saldo & total earned affiliate
        await prisma.affiliate.update({
          where: { id: userAffiliateId },
          data: {
            balance: { increment: commissionAmount },
            totalEarned: { increment: commissionAmount },
          },
        });

        commissionInfo = {
          affiliateEmail: affiliate.email,
          affiliateName: affiliate.name,
          commission: commissionAmount,
          isRepeatOrder: !isNewUser,
        };
      }
    }

    // ===== 7. Log pesan =====
    await prisma.messageLog.create({
      data: {
        userId: user.id,
        transactionId: transaction.id,
        whatsappNumber: customer.phone || "UNKNOWN",
        messageType: "account_delivery",
        messageContent: `Akun CapCut Pro (${productType}) dikirim ke ${customer.name}. Email: ${account.accountEmail}. Slot: ${newUsedSlots}/${accountMaxSlots}.`,
        status: "sent",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Transaksi berhasil diproses!",
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      account: { email: account.accountEmail, password: account.accountPassword },
      transaction: {
        id: transaction.id,
        refId,
        amount: price,
        product: productTitle,
        productType,
        duration: durationDays,
        slot: `${newUsedSlots}/${accountMaxSlots}`,
        warrantyExpiredAt: warrantyExpiredAt.toISOString(),
      },
      affiliate: commissionInfo,
      questions,
    }, { status: 200 });
  } catch (error) {
    console.error("Webhook Lynk.id error:", error);
    return NextResponse.json({ success: false, message: "Server error", error: String(error) }, { status: 500 });
  }
}

// GET /api/webhook/lynkid - Cek endpoint aktif
export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/webhook/lynkid",
    features: ["sharing_account", "affiliate_auto_commission", "slot_management"],
  });
}
