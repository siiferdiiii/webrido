import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/products — Public product catalog
export async function GET() {
  try {
    // Get product data from app_settings or return defaults
    const setting = await prisma.appSetting.findUnique({
      where: { key: "products" },
    });

    let products = [
      {
        id: "capcut-mobile-30",
        name: "CapCut Pro Mobile",
        description: "Akses semua fitur premium CapCut di HP/iPad/Tablet selama 30 hari",
        price: 15000,
        duration: 30,
        type: "mobile",
        features: ["Semua filter & efek premium", "Export tanpa watermark", "Cloud Storage 100GB", "AI Tools lengkap"],
        popular: false,
      },
      {
        id: "capcut-desktop-30",
        name: "CapCut Pro Desktop",
        description: "Akses semua fitur premium CapCut di PC/Laptop/Mac selama 30 hari",
        price: 20000,
        duration: 30,
        type: "desktop",
        features: ["Semua filter & efek premium", "Export 4K tanpa watermark", "Cloud Storage 100GB", "AI Tools + Desktop plugins"],
        popular: true,
      },
      {
        id: "capcut-mobile-90",
        name: "CapCut Pro Mobile 3 Bulan",
        description: "Hemat 20%! Akses premium CapCut di HP/iPad selama 90 hari",
        price: 35000,
        duration: 90,
        type: "mobile",
        features: ["Semua filter & efek premium", "Export tanpa watermark", "Cloud Storage 100GB", "AI Tools lengkap", "Hemat 20%"],
        popular: false,
      },
      {
        id: "capcut-desktop-90",
        name: "CapCut Pro Desktop 3 Bulan",
        description: "Hemat 25%! Akses premium CapCut di PC/Mac selama 90 hari",
        price: 45000,
        duration: 90,
        type: "desktop",
        features: ["Semua filter & efek premium", "Export 4K tanpa watermark", "Cloud Storage 100GB", "AI Tools + Desktop plugins", "Hemat 25%"],
        popular: true,
      },
    ];

    if (setting?.value) {
      try {
        products = JSON.parse(setting.value);
      } catch { /* use defaults */ }
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Products error:", error);
    return NextResponse.json({ products: [] });
  }
}
