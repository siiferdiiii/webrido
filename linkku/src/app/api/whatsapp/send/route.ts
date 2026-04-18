import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendWhatsApp, sendTemplatedWhatsApp, fillTemplate } from "@/lib/mpwa";

/**
 * POST /api/whatsapp/send
 *
 * Send a single WhatsApp message via MPWA.
 *
 * Body:
 *   - number: string       (required) recipient number
 *   - message: string      (required if no template) direct message text
 *   - template: string     (optional) template with {{placeholders}}
 *   - vars: Record<string,string> (optional) variables for template
 *   - footer: string       (optional) footer text
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { number, message, template, vars, footer } = body;

    if (!number) {
      return NextResponse.json(
        { error: "Nomor WA (number) wajib diisi" },
        { status: 400 }
      );
    }

    if (!message && !template) {
      return NextResponse.json(
        { error: "message atau template wajib diisi" },
        { status: 400 }
      );
    }

    let result;

    if (template && vars) {
      // Send using template + variable substitution
      result = await sendTemplatedWhatsApp(number, template, vars, footer);
    } else {
      // Send direct message
      result = await sendWhatsApp({
        number,
        message: template ? fillTemplate(template, vars || {}) : message,
        footer,
      });
    }

    if (result.status) {
      return NextResponse.json({
        success: true,
        message: "Pesan berhasil dikirim",
        data: result.data,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.msg || result.error || "Gagal mengirim pesan",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("POST /api/whatsapp/send error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
