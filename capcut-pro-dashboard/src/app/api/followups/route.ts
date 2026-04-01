import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/followups - Daftar jadwal follow-up
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const followups = await prisma.scheduledFollowup.findMany({
      where,
      include: {
        _count: { select: { recipients: true } },
        recipients: { select: { status: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });

    // Hitung sentCount secara dinamis dari status recipient (bukan dari field stored)
    const followupsWithCount = followups.map((f) => {
      const dynamicSentCount = f.recipients.filter((r) => r.status !== "pending").length;
      return {
        ...f,
        sentCount: dynamicSentCount,
        recipients: undefined, // Jangan expose detail recipients di list
      };
    });

    return NextResponse.json({ followups: followupsWithCount });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/followups - Buat jadwal follow-up baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, messageTemplate, scheduledAt, recipients } = body;

    if (!title || !messageTemplate || !scheduledAt || !recipients?.length) {
      return NextResponse.json({ error: "Judul, template pesan, tanggal, dan daftar penerima wajib diisi" }, { status: 400 });
    }

    // Parse daftar penerima: bisa array of { whatsappNumber, customerName }
    // atau string nomor dipisah newline
    let recipientList: { whatsappNumber: string; customerName?: string }[] = [];
    if (typeof recipients === "string") {
      recipientList = recipients.split("\n").filter((l: string) => l.trim()).map((line: string) => {
        const parts = line.trim().split(/[,\t|]+/);
        return { whatsappNumber: parts[0].trim(), customerName: parts[1]?.trim() || undefined };
      });
    } else {
      recipientList = recipients;
    }

    const followup = await prisma.scheduledFollowup.create({
      data: {
        title,
        messageTemplate,
        scheduledAt: new Date(scheduledAt),
        totalRecipients: recipientList.length,
        recipients: {
          create: recipientList.map((r) => ({
            whatsappNumber: r.whatsappNumber,
            customerName: r.customerName || null,
          })),
        },
      },
      include: { 
        recipients: true,
        _count: { select: { recipients: true } } 
      },
    });

    // Send to n8n Webhook
    try {
      const webhookUrl = "https://appsheetindonesia-dorrizstore.qxifii.easypanel.host/webhook/5ba40d68-0e44-4e0a-ac6a-b0df499653a4";
      const payload = {
        followupId: followup.id,
        title: followup.title,
        messageTemplate: followup.messageTemplate,
        scheduledAt: followup.scheduledAt,
        recipients: followup.recipients.map((r) => ({
          id: r.id,
          whatsappNumber: r.whatsappNumber,
          customerName: r.customerName,
        })),
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log(`[Follow-Up] Webhook sent for ${followup.id}`);
    } catch (webhookError) {
      console.error("[Follow-Up] Failed to send webhook:", webhookError);
      // We don't fail the response if the webhook fails, but we log the error
    }

    return NextResponse.json({ followup }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
