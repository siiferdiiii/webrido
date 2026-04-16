/**
 * OrderKuota / OkeConnect H2H API Client
 * Digunakan untuk top-up saldo DANA affiliate otomatis
 *
 * Base URL: https://h2h.okeconnect.com/trx
 * Produk: BBSD (open denom DANA, min 10k)
 */

const BASE_URL = "https://h2h.okeconnect.com/trx";

interface OrderKuotaConfig {
  memberID: string;
  password: string;
  pin: string;
}

function getConfig(): OrderKuotaConfig {
  const memberID = process.env.ORDERKUOTA_MEMBER_ID;
  const password = process.env.ORDERKUOTA_PASSWORD;
  const pin = process.env.ORDERKUOTA_PIN;

  if (!memberID || !password || !pin) {
    throw new Error("OrderKuota API credentials not configured");
  }

  return { memberID, password, pin };
}

export interface OrderKuotaResponse {
  success: boolean;
  data?: {
    trxid?: string;
    ref_id?: string;
    status?: string;
    product?: string;
    dest?: string;
    price?: number;
    balance?: number;
    message?: string;
    sn?: string; // Serial number
    [key: string]: unknown;
  };
  raw?: string;
  error?: string;
}

/**
 * Top up saldo DANA ke nomor HP tujuan
 * @param dest - Nomor HP tujuan (format 08xxx)
 * @param amount - Nominal top up (min 10000)
 * @param refID - Reference ID unik (pakai withdrawal ID)
 */
export async function topupDANA(
  dest: string,
  amount: number,
  refID: string
): Promise<OrderKuotaResponse> {
  const config = getConfig();

  // Clean phone number - remove spaces, dashes
  const cleanDest = dest.replace(/[\s\-]/g, "");

  const params = new URLSearchParams({
    product: "BBSD",
    dest: cleanDest,
    qty: amount.toString(),
    refID: refID,
    memberID: config.memberID,
    pin: config.pin,
    password: config.password,
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    console.log(`[OrderKuota] Sending DANA top-up: dest=${cleanDest}, amount=${amount}, refID=${refID}`);

    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const text = await response.text();
    console.log(`[OrderKuota] Raw response: ${text}`);

    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      const isSuccess = data.result === true || data.status === "success" || data.success === true;

      return {
        success: isSuccess,
        data: data,
        raw: text,
      };
    } catch {
      // Response is NOT JSON — parse raw text
      // OkeConnect returns formats like:
      //   Success: "R#ddddc221-1845-4a1b-9bc5-04eb8b8ad4cd BB..."  (has R# + reference ID)
      //   Success: contains "sukses" / "success" / "berhasil"
      //   Failure: contains "gagal" / "error" / "saldo tidak" / "produk tidak"
      const lower = text.toLowerCase();

      // Explicit failure keywords
      const isExplicitFail =
        lower.includes("gagal") ||
        lower.includes("failed") ||
        lower.includes("error") ||
        lower.includes("saldo tidak") ||
        lower.includes("produk tidak") ||
        lower.includes("nomor tidak valid") ||
        lower.includes("tidak ditemukan") ||
        lower.includes("ditolak");

      // Success indicators
      const hasRefId = text.includes("R#") || /[0-9a-f]{8}-[0-9a-f]{4}/.test(text);
      const hasSuccessKeyword = lower.includes("sukses") || lower.includes("success") || lower.includes("berhasil");
      const isSuccess = !isExplicitFail && (hasRefId || hasSuccessKeyword);

      // Extract transaction ID from R# format
      const refMatch = text.match(/R#([\w-]+)/);
      const trxId = refMatch ? refMatch[1] : undefined;

      console.log(`[OrderKuota] Parsed: isSuccess=${isSuccess}, isExplicitFail=${isExplicitFail}, hasRefId=${hasRefId}, trxId=${trxId}`);

      return {
        success: isSuccess,
        data: trxId ? { trxid: trxId } : undefined,
        raw: text,
        error: isSuccess ? undefined : text,
      };
    }
  } catch (error) {
    console.error(`[OrderKuota] Error:`, error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Cek status transaksi
 */
export async function checkTransaction(
  dest: string,
  amount: number,
  refID: string
): Promise<OrderKuotaResponse> {
  const config = getConfig();

  const params = new URLSearchParams({
    product: "BBSD",
    dest: dest.replace(/[\s\-]/g, ""),
    qty: amount.toString(),
    refID: refID,
    memberID: config.memberID,
    pin: config.pin,
    password: config.password,
    check: "1", // Flag untuk cek status
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return { success: true, data, raw: text };
    } catch {
      return { success: false, raw: text, error: text };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Cek saldo akun OrderKuota
 */
export async function checkBalance(): Promise<{ balance: number | null; error?: string }> {
  const config = getConfig();

  const params = new URLSearchParams({
    product: "CEK",
    dest: "SALDO",
    memberID: config.memberID,
    pin: config.pin,
    password: config.password,
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return { balance: data.balance || data.saldo || null };
    } catch {
      // Try to extract balance from text
      const match = text.match(/(\d[\d.,]+)/);
      return { balance: match ? parseFloat(match[1].replace(/[.,]/g, "")) : null };
    }
  } catch (error) {
    return { balance: null, error: String(error) };
  }
}
