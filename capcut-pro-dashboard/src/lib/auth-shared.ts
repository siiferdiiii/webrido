// ─── Shared auth constants & types (safe for client AND server) ──────────────
// JANGAN import server-only modules di sini (bcrypt, jose, cookies, NextResponse)

export const ALL_PERMISSIONS = {
  page_transactions: "Halaman Transaksi",
  page_customers: "Halaman Pelanggan",
  page_stock: "Halaman Stok Akun",
  page_followup: "Halaman Follow-Up",
  page_retention: "Analisis Retensi",
  page_affiliates: "Halaman Afiliator",
  page_messages: "Riwayat Pesan",
  page_settings: "Halaman Settings",
  export_data: "Export CSV",
  import_data: "Import CSV/Excel",
  delete_data: "Hapus Data",
} as const;

export type PermissionKey = keyof typeof ALL_PERMISSIONS;

export const DEFAULT_ADMIN_PERMISSIONS: Record<PermissionKey, boolean> = {
  page_transactions: true,
  page_customers: true,
  page_stock: false,
  page_followup: true,
  page_retention: true,
  page_affiliates: false,
  page_messages: true,
  page_settings: false,
  export_data: true,
  import_data: false,
  delete_data: false,
};
