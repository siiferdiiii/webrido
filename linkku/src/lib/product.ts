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
