import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const stock = await prisma.stockAccount.findMany({ select: { id: true, accountEmail: true, productType: true, status: true, usedSlots: true, maxSlots: true } });
  return NextResponse.json({ stock });
}
