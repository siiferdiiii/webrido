import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/products — Public product catalog with live stock counts
export async function GET() {
  try {
    // Get product data from app_settings or return defaults
    const setting = await prisma.appSetting.findUnique({
      where: { key: "products" },
    });

    let products = [
      {
        id: "CPM-30",
        name: "CapCut Pro Mobile",
        description: "Akses semua fitur premium CapCut di HP/iPad/Tablet selama 30 hari",
        price: 15000,
        duration: 30,
        type: "mobile",
        features: ["Semua filter & efek premium", "Export tanpa watermark", "Cloud Storage 100GB", "AI Tools lengkap"],
        popular: false,
      },
      {
        id: "CPD-30",
        name: "CapCut Pro Desktop",
        description: "Akses semua fitur premium CapCut di PC/Laptop/Mac selama 30 hari",
        price: 20000,
        duration: 30,
        type: "desktop",
        features: ["Semua filter & efek premium", "Export 4K tanpa watermark", "Cloud Storage 100GB", "AI Tools + Desktop plugins"],
        popular: true,
      },
    ];

    if (setting?.value) {
      try {
        products = JSON.parse(setting.value);
      } catch { /* use defaults */ }
    }

    // Fetch live stock counts per product type
    const stockCounts = await prisma.stockAccount.groupBy({
      by: ["productType"],
      where: { status: "available" },
      _sum: { maxSlots: true, usedSlots: true },
      _count: true,
    });

    // Build a map: productType -> available slots
    const stockMap: Record<string, { accounts: number; slots: number }> = {};
    for (const row of stockCounts) {
      const dbType = (row.productType || "mobile").toLowerCase();
      const totalSlots = row._sum.maxSlots || 0;
      const usedSlots = row._sum.usedSlots || 0;
      
      // Accumulate in case there are multiple case variants
      if (!stockMap[dbType]) stockMap[dbType] = { accounts: 0, slots: 0 };
      stockMap[dbType].accounts += row._count;
      stockMap[dbType].slots += Math.max(0, totalSlots - usedSlots);
    }

    // Attach stock info to each product
    const productsWithStock = products.map((p) => {
      const skuStock = stockMap[p.id.toLowerCase()];
      const typeStock = stockMap[p.type.toLowerCase()];
      
      const stockInfo = skuStock || typeStock || { accounts: 0, slots: 0 };
      return {
        ...p,
        stock: stockInfo,
      };
    });

    return NextResponse.json({ products: productsWithStock });
  } catch (error) {
    console.error("Products error:", error);
    return NextResponse.json({ products: [] });
  }
}
