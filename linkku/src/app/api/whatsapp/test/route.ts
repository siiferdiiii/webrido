import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { testMPWAConnection } from "@/lib/mpwa";

/**
 * POST /api/whatsapp/test
 *
 * Test MPWA connection by sending a test message.
 * Body (optional):
 *   - number: string   test number to send to
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await testMPWAConnection(body.number);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/whatsapp/test error:", error);
    return NextResponse.json(
      { ok: false, message: String(error) },
      { status: 500 }
    );
  }
}
