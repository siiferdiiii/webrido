import { prisma } from "@/lib/db";

/**
 * Shared product utility — parseProductType
 * Detects whether a product title describes a Mobile or Desktop product.
 */
export function parseProductType(title: string): "mobile" | "desktop" {
  const lower = (title || "").toLowerCase();
  if (
    lower.includes("laptop") ||
    lower.includes("mac") ||
    lower.includes("desktop") ||
    lower.includes("pc") ||
    lower.includes("dekstop")
  ) {
    return "desktop";
  }
  return "mobile"; // HP/iPad/Tablet = default
}

/**
 * DB-aware helper to safely find the exact SKU ID for a given product name.
 * If an exact SKU exists in `appSetting.products`, it returns that SKU.
 * Otherwise, it falls back to the legacy "mobile" or "desktop" string based on parseProductType.
 * It also returns the resolved base productType (mobile/desktop).
 */
export async function resolveProductSku(productName: string): Promise<{ sku: string; baseType: "mobile" | "desktop" }> {
  let targetSku: string | null = null;
  const baseType = parseProductType(productName);
  
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "products" } });
    if (setting && setting.value) {
      const products = JSON.parse(setting.value);
      const searchName = (productName || "").trim().toLowerCase();
      const matched = products.find((p: any) => searchName.includes(p.name.toLowerCase()));
      if (matched) targetSku = matched.id;
    }
  } catch (e) {
    console.error("[resolveProductSku] Error fetching products API:", e);
  }
  
  return { 
    sku: targetSku || baseType, 
    baseType 
  };
}
