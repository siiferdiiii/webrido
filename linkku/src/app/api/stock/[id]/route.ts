import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/stock/[id] — Hapus stok akun
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Cek apakah akun masih dipakai (ada transaksi aktif)
    const account = await prisma.stockAccount.findUnique({
      where: { id },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
    }

    // Boleh hapus hanya jika slot kosong (tidak ada pengguna aktif)
    if ((account.usedSlots ?? 0) > 0) {
      return NextResponse.json(
        { error: "Akun sedang digunakan pelanggan aktif. Pastikan slot kosong sebelum menghapus." },
        { status: 400 }
      );
    }

    // Hapus akun (transactions yang terhubung akan di-SET NULL pada stock_account_id karena ON DELETE SET NULL)
    await prisma.stockAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/stock/[id] error:", error);
    return NextResponse.json({ error: "Gagal menghapus akun" }, { status: 500 });
  }
}

// PATCH /api/stock/[id] — Update status akun
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await prisma.stockAccount.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.usedSlots !== undefined && { usedSlots: body.usedSlots }),
      },
    });

    return NextResponse.json({ account: updated });
  } catch (error) {
    console.error("PATCH /api/stock/[id] error:", error);
    return NextResponse.json({ error: "Gagal update akun" }, { status: 500 });
  }
}
