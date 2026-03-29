import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/followups/[id] - Detail follow-up + daftar penerima
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const followup = await prisma.scheduledFollowup.findUnique({
      where: { id },
      include: { recipients: { orderBy: { status: "asc" } } },
    });
    if (!followup) {
      return NextResponse.json({ error: "Follow-up tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ followup });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PATCH /api/followups/[id] - Update status follow-up atau tandai penerima terkirim
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Jika update status recipient
    if (body.recipientId) {
      const recipient = await prisma.scheduledFollowupRecipient.update({
        where: { id: body.recipientId },
        data: { status: body.status || "sent", sentAt: new Date() },
      });

      // Update sent_count di followup
      const sentCount = await prisma.scheduledFollowupRecipient.count({
        where: { followupId: id, status: "sent" },
      });
      const totalRecipients = await prisma.scheduledFollowupRecipient.count({
        where: { followupId: id },
      });

      await prisma.scheduledFollowup.update({
        where: { id },
        data: {
          sentCount,
          status: sentCount >= totalRecipients ? "completed" : "processing",
        },
      });

      return NextResponse.json({ recipient, sentCount, totalRecipients });
    }

    // Update status follow-up (cancel, dll)
    if (body.status) {
      const followup = await prisma.scheduledFollowup.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json({ followup });
    }

    return NextResponse.json({ error: "Field update tidak valid" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE /api/followups/[id] - Hapus follow-up (cascade recipients)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.scheduledFollowup.delete({ where: { id } });
    return NextResponse.json({ message: "Follow-up berhasil dihapus" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
