/**
 * MPWA WhatsApp Gateway API Client
 *
 * Endpoint: https://ai.appsheetindonesia.my.id/send-message
 * Method: POST (JSON)
 *
 * Used for:
 * - Sending account credentials to customers
 * - Follow-up reminders
 * - Warranty claim notifications
 * - Promo broadcasts
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MPWASendRequest {
  number: string;     // Recipient number (62888xxxx)
  message: string;    // Message content
  footer?: string;    // Optional footer text
  msgid?: string;     // Optional: quoted message ID to reply to
}

export interface MPWAResponse {
  status: boolean;
  msg?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: unknown;
    messageTimestamp?: string;
  };
  error?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

function getConfig() {
  const apiUrl = process.env.MPWA_API_URL;
  const apiKey = process.env.MPWA_API_KEY;
  const sender = process.env.MPWA_SENDER;

  if (!apiUrl || !apiKey || !sender) {
    throw new Error(
      "MPWA not configured. Set MPWA_API_URL, MPWA_API_KEY, and MPWA_SENDER in .env"
    );
  }

  return { apiUrl, apiKey, sender };
}

// ─── Send Message ────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp text message via MPWA API.
 *
 * @param options - Message parameters
 * @returns API response
 */
export async function sendWhatsApp(
  options: MPWASendRequest
): Promise<MPWAResponse> {
  const config = getConfig();

  // Clean phone number: remove spaces, dashes, leading +
  let cleanNumber = options.number.replace(/[\s\-\+]/g, "");

  // Convert 08xx to 628xx
  if (cleanNumber.startsWith("08")) {
    cleanNumber = "62" + cleanNumber.substring(1);
  }
  // Convert +628xx to 628xx (already handled by removing +)
  if (!cleanNumber.startsWith("62")) {
    cleanNumber = "62" + cleanNumber;
  }

  const payload = {
    api_key: config.apiKey,
    sender: config.sender,
    number: cleanNumber,
    message: options.message,
    ...(options.footer && { footer: options.footer }),
    ...(options.msgid && { msgid: options.msgid }),
  };

  try {
    console.log(
      `[MPWA] Sending message to ${cleanNumber}: ${options.message.substring(0, 50)}...`
    );

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text) as MPWAResponse;
      console.log(
        `[MPWA] Response: status=${data.status}, msg=${data.msg || "N/A"}`
      );
      return data;
    } catch {
      console.error(`[MPWA] Non-JSON response: ${text}`);
      return { status: false, error: text };
    }
  } catch (error) {
    console.error(`[MPWA] Error:`, error);
    return { status: false, error: String(error) };
  }
}

// ─── Template Substitution ───────────────────────────────────────────────────

/**
 * Replace template placeholders with actual values.
 *
 * Supported placeholders:
 * - {{nama}} - Customer name
 * - {{akun_email}} - Account email
 * - {{akun_password}} - Account password
 * - {{tipe}} - Product type
 * - {{durasi}} - Duration in days
 * - {{tanggal_expired}} - Warranty expiry date
 * - {{nomor_wa}} - Customer WA number
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(placeholder, String(value ?? "-"));
  }

  return result;
}

// ─── Send with Template ──────────────────────────────────────────────────────

/**
 * Send a templated WhatsApp message.
 *
 * @param number - Recipient number
 * @param template - Message template with {{placeholders}}
 * @param vars - Key-value pairs for placeholder substitution
 * @param footer - Optional footer text
 */
export async function sendTemplatedWhatsApp(
  number: string,
  template: string,
  vars: Record<string, string | number | null | undefined>,
  footer?: string
): Promise<MPWAResponse> {
  const message = fillTemplate(template, vars);
  return sendWhatsApp({ number, message, footer });
}

// ─── Bulk Send with Rate Limiting ────────────────────────────────────────────

interface BulkSendItem {
  number: string;
  message: string;
  footer?: string;
}

interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    number: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Send messages to multiple recipients with delay between each.
 *
 * @param items - Array of messages to send
 * @param delayMs - Delay between messages in ms (default: 3000 = 3 seconds)
 * @param onProgress - Optional callback for progress updates
 */
export async function bulkSendWhatsApp(
  items: BulkSendItem[],
  delayMs: number = 3000,
  onProgress?: (sent: number, total: number) => void
): Promise<BulkSendResult> {
  const result: BulkSendResult = {
    total: items.length,
    sent: 0,
    failed: 0,
    results: [],
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      const response = await sendWhatsApp(item);
      if (response.status) {
        result.sent++;
        result.results.push({ number: item.number, success: true });
      } else {
        result.failed++;
        result.results.push({
          number: item.number,
          success: false,
          error: response.msg || response.error || "Unknown error",
        });
      }
    } catch (error) {
      result.failed++;
      result.results.push({
        number: item.number,
        success: false,
        error: String(error),
      });
    }

    // Progress callback
    onProgress?.(i + 1, items.length);

    // Delay between messages (skip after last message)
    if (i < items.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return result;
}

// ─── Test Connection ─────────────────────────────────────────────────────────

/**
 * Test MPWA connection by sending a test message.
 */
export async function testMPWAConnection(
  testNumber?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const config = getConfig();

    // If no test number provided, just check config is valid
    if (!testNumber) {
      return { ok: true, message: "MPWA configuration is valid" };
    }

    const response = await sendWhatsApp({
      number: testNumber,
      message: "✅ Test koneksi MPWA berhasil! Pesan ini dikirim dari Dorizz Store Dashboard.",
      footer: "Dorizz Store · Automated Message",
    });

    return {
      ok: response.status,
      message: response.status
        ? "Pesan test berhasil dikirim!"
        : `Gagal mengirim: ${response.msg || response.error}`,
    };
  } catch (error) {
    return { ok: false, message: String(error) };
  }
}
