import { createClient } from "@supabase/supabase-js";

// ─── Supabase Browser Client (for Realtime subscriptions) ─────────────────────
// This client is used on the frontend for real-time table subscriptions.
// It does NOT replace Prisma — Prisma is still used for all CRUD operations.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Realtime features will not work."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
