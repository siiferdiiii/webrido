import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // 60 detik (Vercel Pro) atau 10 detik (Hobby)
export const dynamic = "force-dynamic";

// Mapping kolom Lynk.id ke database kita
interface LynkTransaction {
  id?: string;
  price?: number;
  qty?: number;
  sub_total?: number;
  Voucher?: number;
  "Shipping fee"?: number;
  "Total Admin fee"?: number;
  total?: number;
  "purchased date"?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;         // SUCCESS | PENDING | FAILED dll
  "Addres Data"?: string;
  "Voucher Code"?: string;
  appointment_time?: string;
  Produk?: string;
  // Alternative snake_case format
  purchased_date?: string;
  shipping_fee?: number;
  total_admin_fee?: number;
  address_data?: string;
  voucher_code?: string;
  produk?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transactions: rawTransactions } = body as { transactions: LynkTransaction[] };

    if (!rawTransactions || !Array.isArray(rawTransactions) || rawTransactions.length === 0) {
      return NextResponse.json({ error: "Data transaksi kosong atau format tidak valid" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    let skippedNonSuccess = 0; // transaksi PENDING/FAILED/dll
    let usersCreated = 0;
    let usersUpdated = 0;
    const errors: string[] = [];

    // ===== STEP 1: Parse dan validasi semua data di memory =====
    interface ParsedTrx {
      lynkId: string | null;
      email: string;
      name: string;
      phone: string | null;
      amount: number;
      purchaseDate: Date;
      warrantyExpiredAt: Date;
      productName: string | null;
    }
    const parsedRows: ParsedTrx[] = [];

    for (const rawTrx of rawTransactions) {
      // Normalkan semua key menjadi lowercase untuk mencegah bug case-sensitivity (contoh: Email vs email)
      const trx: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawTrx)) {
        trx[key.toLowerCase().trim()] = value;
      }

      const rawId = trx.id || trx["lynkid"] || trx["lynk id"] || trx["lynk.id"] || trx["lynk.id order id"] || trx.ref || trx["ref."];
      const lynkId = rawId ? String(rawId).trim() : null;
      
      const rawEmail = trx.email || trx["buyer email"] || trx["email pembeli"];
      const email = typeof rawEmail === 'string' ? rawEmail.trim() : null;
      
      const rawName = trx.name || trx.nama || trx.pelanggan || trx["buyer name"] || trx["nama pembeli"] || trx["buyer name (opsional)"];
      const name = typeof rawName === 'string' ? rawName.trim() : "Tanpa Nama";
      
      const rawPhone = trx.phone || trx["no hp"] || trx.whatsapp || trx.wa || trx["buyer phone"] || String(trx["buyer phone (opsional)"] || "");
      const phone = typeof rawPhone === 'string' && rawPhone ? rawPhone.trim() : null;
      
      const rawAmount = trx.total || trx.sub_total || trx.price || trx.nominal || trx.harga || 0;
      const amount = Number(rawAmount) || 0;

      const rawProduct = trx.produk || trx.product || trx["nama produk"] || trx.item || trx.title || trx.nama_produk || trx["judul barang"];
      const productName = typeof rawProduct === 'string' && rawProduct ? rawProduct.trim() : null;

      // ── Status transaksi dari Lynk.id ──────────────────────────────────────
      // Hanya import transaksi dengan status SUCCESS. Skip PENDING, FAILED, dll.
      const rawStatus = trx.status || trx["order status"] || trx["payment status"] || "";
      const trxStatus = String(rawStatus).trim().toUpperCase();
      if (trxStatus && trxStatus !== "SUCCESS") {
        skippedNonSuccess++;
        continue; // lewati transaksi non-success
      }
      
      const purchasedDateStr = trx["purchased date"] || trx.purchased_date || trx.tanggal || trx.date || trx["tanggal pembelian"] || null;

      if (!email || !lynkId) {
        skipped++;
        if (errors.length < 10) {
          if (!email) errors.push(`Baris dilewati: email kosong (ID: ${lynkId || "?"})`);
          else errors.push(`Baris dilewati: Order ID kosong (Email: ${email})`);
        }
        continue;
      }

      let purchaseDate: Date;
      if (purchasedDateStr) {
        // Coba parsing format DD/MM/YYYY atau DD-MM-YYYY
        const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
        const match = String(purchasedDateStr).trim().match(dateRegex);
        
        if (match) {
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // Bulan 0-indexed
          let year = parseInt(match[3]);
          if (year < 100) year += 2000;
          
          const hours = parseInt(match[4] || '0');
          const minutes = parseInt(match[5] || '0');
          const seconds = parseInt(match[6] || '0');
          
          purchaseDate = new Date(year, month, day, hours, minutes, seconds);
        } else {
          // Fallback ke default parser jika bukan DD/MM/YYYY
          purchaseDate = new Date(purchasedDateStr);
        }
        
        if (isNaN(purchaseDate.getTime())) purchaseDate = new Date();
      } else {
        purchaseDate = new Date();
      }

      const warrantyExpiredAt = new Date(purchaseDate);
      warrantyExpiredAt.setDate(warrantyExpiredAt.getDate() + 30);

      parsedRows.push({ lynkId, email, name, phone, amount, purchaseDate, warrantyExpiredAt, productName });
    }

    // ===== STEP 2: Bulk fetch existing data =====
    // Ambil semua lynkIdRef yang sudah ada di DB (untuk skip duplikat)
    const allLynkIds = parsedRows.map(r => r.lynkId).filter((id): id is string => !!id);
    const existingTrxSet = new Set<string>();

    if (allLynkIds.length > 0) {
      // Fetch in chunks of 500 to avoid query size limits
      for (let i = 0; i < allLynkIds.length; i += 500) {
        const chunk = allLynkIds.slice(i, i + 500);
        const existing = await prisma.transaction.findMany({
          where: { lynkIdRef: { in: chunk } },
          select: { lynkIdRef: true },
        });
        existing.forEach(t => { if (t.lynkIdRef) existingTrxSet.add(t.lynkIdRef); });
      }
    }

    // Filter rows yang sudah ada
    const newRows = parsedRows.filter(r => {
      if (r.lynkId && existingTrxSet.has(r.lynkId)) {
        skipped++;
        return false;
      }
      return true;
    });

    // Ambil semua email unik dan fetch existing users sekaligus
    const uniqueEmails = [...new Set(newRows.map(r => r.email))];
    const existingUsersMap = new Map<string, { id: string; name: string; whatsapp: string | null }>();

    for (let i = 0; i < uniqueEmails.length; i += 500) {
      const chunk = uniqueEmails.slice(i, i + 500);
      const users = await prisma.user.findMany({
        where: { email: { in: chunk } },
        select: { id: true, email: true, name: true, whatsapp: true },
      });
      users.forEach(u => existingUsersMap.set(u.email, { id: u.id, name: u.name, whatsapp: u.whatsapp }));
    }

    // ===== STEP 3: Batch upsert users & create transactions in chunks =====
    const CHUNK_SIZE = 10; // Lebih kecil agar tidak timeout per-chunk

    for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
      const chunk = newRows.slice(i, i + CHUNK_SIZE);

      await prisma.$transaction(async (tx) => {
        for (const row of chunk) {
          try {
            let userId: string;
            const existingUser = existingUsersMap.get(row.email);

            if (!existingUser) {
              // Buat user baru
              const newUser = await tx.user.create({
                data: {
                  email: row.email,
                  name: row.name,
                  whatsapp: row.phone,
                  subscriptionStatus: "active",
                  customerType: "new",
                },
              });
              userId = newUser.id;
              existingUsersMap.set(row.email, { id: newUser.id, name: row.name, whatsapp: row.phone });
              usersCreated++;
            } else {
              userId = existingUser.id;
              // Update jika perlu
              const updateData: Record<string, unknown> = {};
              if (row.phone && !existingUser.whatsapp) updateData.whatsapp = row.phone;
              if (row.name && row.name !== "Tanpa Nama" && existingUser.name !== row.name) updateData.name = row.name;
              updateData.subscriptionStatus = "active";

              if (Object.keys(updateData).length > 0) {
                await tx.user.update({ where: { id: userId }, data: updateData });
                usersUpdated++;
              }
            }

            // Buat transaksi
            await tx.transaction.create({
              data: {
                lynkIdRef: row.lynkId,
                userId,
                amount: row.amount,
                productName: row.productName,
                status: "success",
                isManual: false,
                purchaseDate: row.purchaseDate,
                warrantyExpiredAt: row.warrantyExpiredAt,
              },
            });

            created++;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (errorMsg.includes("Unique constraint")) {
              skipped++;
            } else {
              if (errors.length < 10) errors.push(`Error pada ID ${row.lynkId || "?"}: ${errorMsg}`);
            }
          }
        }
      }, {
        maxWait: 5000,
        timeout: 20000
      });

      // Yield CPU sedikit antar chunk agar tidak blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: rawTransactions.length,
        created,
        skipped,
        skippedNonSuccess,
        usersCreated,
        usersUpdated,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("[Import Transactions] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
