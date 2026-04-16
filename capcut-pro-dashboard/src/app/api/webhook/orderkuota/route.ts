import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/webhook/orderkuota — Callback dari OrderKuota
 * 
 * OrderKuota mengirim status transaksi via GET request
 * Parameter yang dikirim: refid, message, status, sn, dll.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Extract callback parameters
    const refId = searchParams.get("refid") || searchParams.get("ref_id") || searchParams.get("refID");
    const message = searchParams.get("message") || searchParams.get("msg") || "";
    const status = searchParams.get("status") || "";
    const sn = searchParams.get("sn") || ""; // Serial number (bukti transaksi)
    const trxId = searchParams.get("trxid") || searchParams.get("trx_id") || "";

    console.log(`[OrderKuota Callback] refId=${refId}, status=${status}, message=${message}, sn=${sn}, trxId=${trxId}`);

    if (!refId) {
      return NextResponse.json({ error: "refid parameter required" }, { status: 400 });
    }

    // Find the withdrawal by ID (refId = withdrawal ID)
    const withdrawal = await prisma.affiliateWithdrawal.findUnique({
      where: { id: refId },
    });

    if (!withdrawal) {
      console.log(`[OrderKuota Callback] Withdrawal not found: ${refId}`);
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    // Determine if transaction succeeded or failed
    const isSuccess =
      status.toLowerCase() === "sukses" ||
      status.toLowerCase() === "success" ||
      status.toLowerCase() === "berhasil" ||
      message.toLowerCase().includes("sukses") ||
      message.toLowerCase().includes("success") ||
      message.toLowerCase().includes("berhasil") ||
      (sn && sn.length > 0); // If there's a serial number, it's likely success

    const isFailed =
      status.toLowerCase() === "gagal" ||
      status.toLowerCase() === "failed" ||
      message.toLowerCase().includes("gagal") ||
      message.toLowerCase().includes("failed");

    const callbackNotes = ` | Callback: ${status} - ${message}${sn ? ` (SN: ${sn})` : ""}${trxId ? ` (TrxID: ${trxId})` : ""}`;

    if (isSuccess) {
      // ✅ Transaction succeeded
      await prisma.affiliateWithdrawal.update({
        where: { id: refId },
        data: {
          status: "approved",
          processedAt: new Date(),
          notes: (withdrawal.notes || "") + callbackNotes,
        },
      });

      console.log(`[OrderKuota Callback] ✅ Withdrawal ${refId} approved`);
    } else if (isFailed) {
      // ❌ Transaction failed — refund balance
      await prisma.affiliateWithdrawal.update({
        where: { id: refId },
        data: {
          status: "rejected",
          processedAt: new Date(),
          notes: (withdrawal.notes || "") + callbackNotes,
        },
      });

      // Refund affiliate balance
      await prisma.affiliate.update({
        where: { id: withdrawal.affiliateId! },
        data: {
          balance: { increment: Number(withdrawal.amount) },
        },
      });

      console.log(`[OrderKuota Callback] ❌ Withdrawal ${refId} rejected, balance refunded`);
    } else {
      // ⏳ Unknown/pending status — log but don't change status yet
      await prisma.affiliateWithdrawal.update({
        where: { id: refId },
        data: {
          notes: (withdrawal.notes || "") + callbackNotes,
        },
      });

      console.log(`[OrderKuota Callback] ⏳ Withdrawal ${refId} received unknown status: ${status}`);
    }

    return NextResponse.json({ success: true, message: "Callback processed" });
  } catch (error) {
    console.error("[OrderKuota Callback] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST method as backup (some providers use POST for callbacks)
export async function POST(req: NextRequest) {
  return GET(req);
}
