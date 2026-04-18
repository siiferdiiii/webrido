import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/followups/callback - Menerima status update webhook dari n8n
export async function POST(req: NextRequest) {
  try {
    // FIX #9: Validasi secret dari n8n (opsional, aktif jika env var di-set)
    const webhookSecret = req.headers.get("x-webhook-secret");
    if (process.env.N8N_CALLBACK_SECRET && webhookSecret !== process.env.N8N_CALLBACK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recipientId, status } = body;

    if (!recipientId || !status) {
      return NextResponse.json({ error: "recipientId dan status wajib dikirim" }, { status: 400 });
    }

    // 1. Update status penerima di database
    const recipient = await prisma.scheduledFollowupRecipient.update({
      where: { id: recipientId },
      data: { 
        status: status, // "sent" atau "failed"
        sentAt: status === "sent" ? new Date() : null,
      },
      include: { followup: true }
    });

    if (!recipient) {
      return NextResponse.json({ error: "Penerima tidak ditemukan" }, { status: 404 });
    }

    // 2. Jika status adalah 'sent' atau 'failed', kita hitung dan perbarui sentCount di tabel Followup induk
    if (recipient.followupId) {
      const parentId = recipient.followupId;
      
      // Hitung berapa penerima yang sudah diproses (bukan pending)
      const sentCount = await prisma.scheduledFollowupRecipient.count({
        where: { 
          followupId: parentId,
          status: { not: "pending" }
        }
      });

      // Update parent sentCount. Jika semua sudah diproses, update status parent ke "completed"
      const parent = recipient.followup;
      const totalRecipients = parent?.totalRecipients || 0;
      
      let newParentStatus: string;
      if (sentCount >= totalRecipients && totalRecipients > 0) {
        newParentStatus = "completed";
      } else if (sentCount > 0) {
        newParentStatus = "processing";
      } else {
        newParentStatus = parent?.status || "pending";
      }

      await prisma.scheduledFollowup.update({
        where: { id: parentId },
        data: {
          sentCount: sentCount,
          status: newParentStatus
        }
      });
    }

    return NextResponse.json({ success: true, message: "Status penerima berhasil diupdate" }, { status: 200 });

  } catch (error) {
    console.error("[Webhook Callback] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
