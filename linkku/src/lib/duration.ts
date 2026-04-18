/**
 * Shared duration parser — digunakan di webhook, transactions, dan import.
 * "1 bulan" SELALU = 30 hari fix (bukan kalender bulan yang bervariasi 28/29/30/31)
 */
export function parseDuration(title: string): number {
  const lower = (title || "").toLowerCase();
  if (lower.includes("1 tahun") || lower.includes("12 bulan") || lower.includes("365 hari")) return 365;
  if (lower.includes("6 bulan") || lower.includes("180 hari")) return 180;
  if (lower.includes("3 bulan") || lower.includes("90 hari")) return 90;
  if (lower.includes("2 bulan") || lower.includes("60 hari")) return 60;
  if (lower.includes("1 bulan") || lower.includes("30 hari")) return 30;
  if (lower.includes("2 minggu") || lower.includes("14 hari")) return 14;
  if (lower.includes("1 minggu") || lower.includes("7 hari")) return 7;
  return 0; // 0 = tidak ditemukan, fallback ke durationDays dari stok
}

/**
 * Hitung warrantyExpiredAt berdasarkan purchaseDate + days.
 * Selalu tambah hari fix (BUKAN setMonth) agar konsisten.
 */
export function calcWarrantyExpiry(purchaseDate: Date, days: number): Date {
  const expiry = new Date(purchaseDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}
