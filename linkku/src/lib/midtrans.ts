/**
 * Midtrans Snap API Client
 * Handles creating payment transactions and verifying webhook signatures
 */

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || "";
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === "true";

const BASE_URL = IS_PRODUCTION
  ? "https://app.midtrans.com/snap/v1"
  : "https://app.sandbox.midtrans.com/snap/v1";

const CORE_API_URL = IS_PRODUCTION
  ? "https://api.midtrans.com/v2"
  : "https://api.sandbox.midtrans.com/v2";

function authHeader() {
  return "Basic " + Buffer.from(SERVER_KEY + ":").toString("base64");
}

export interface SnapTransactionRequest {
  transaction_details: {
    order_id: string;
    gross_amount: number;
  };
  customer_details?: {
    first_name?: string;
    email?: string;
    phone?: string;
  };
  item_details?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
  callbacks?: {
    finish?: string;
  };
}

export interface SnapResponse {
  token: string;
  redirect_url: string;
}

/**
 * Create a Snap payment transaction
 */
export async function createSnapTransaction(
  params: SnapTransactionRequest
): Promise<SnapResponse> {
  const res = await fetch(`${BASE_URL}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Midtrans Snap error: ${res.status} — ${errorText}`);
  }

  return res.json();
}

/**
 * Get transaction status from Midtrans Core API
 */
export async function getTransactionStatus(orderId: string) {
  const res = await fetch(`${CORE_API_URL}/${orderId}/status`, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Midtrans status error: ${res.status} — ${errorText}`);
  }

  return res.json();
}

/**
 * Verify webhook signature from Midtrans
 * signature_key = SHA512(order_id + status_code + gross_amount + server_key)
 */
export async function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): Promise<boolean> {
  const payload = orderId + statusCode + grossAmount + SERVER_KEY;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === signatureKey;
}

/**
 * Determine if a Midtrans notification represents a successful payment
 */
export function isPaymentSuccess(
  transactionStatus: string,
  fraudStatus?: string
): boolean {
  if (transactionStatus === "capture") {
    return fraudStatus === "accept";
  }
  return transactionStatus === "settlement";
}

/**
 * Determine if a Midtrans notification represents a failed/cancelled payment
 */
export function isPaymentFailed(transactionStatus: string): boolean {
  return ["deny", "cancel", "expire", "failure"].includes(transactionStatus);
}
