import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/messages - Ambil riwayat pesan
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { whatsappNumber: { contains: search } },
      ];
    }

    if (type === "account_delivery") where.messageType = "account_delivery";
    if (type === "follow_up") where.messageType = { startsWith: "follow_up" };
    if (type === "warranty") where.messageType = "warranty_replacement";

    const [messages, total] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        include: {
          user: { select: { name: true } },
          transaction: { select: { id: true, lynkIdRef: true } },
        },
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.messageLog.count({ where }),
    ]);

    return NextResponse.json({ messages, total, page, limit });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: "Gagal mengambil riwayat pesan" }, { status: 500 });
  }
}

// POST /api/messages - Catat pengiriman pesan baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, transactionId, whatsappNumber, messageType, messageContent, status = "sent" } = body;

    if (!whatsappNumber || !messageType) {
      return NextResponse.json({ error: "Nomor WA dan tipe pesan wajib diisi" }, { status: 400 });
    }

    const message = await prisma.messageLog.create({
      data: {
        userId,
        transactionId,
        whatsappNumber,
        messageType,
        messageContent,
        status,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json({ error: "Gagal mencatat pesan" }, { status: 500 });
  }
}
