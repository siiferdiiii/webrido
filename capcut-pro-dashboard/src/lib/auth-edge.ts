// Edge Runtime compatible — ONLY uses jose (no bcrypt, no prisma, no next/headers)
// Digunakan khusus oleh middleware.ts
import { jwtVerify } from "jose";

export interface AuthPayloadEdge {
  id: string;
  email: string;
  name: string;
  role: "developer" | "admin";
}

export interface AffiliatePayloadEdge {
  id: string;
  email: string;
  name: string;
  role: "affiliate";
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "capcut-dashboard-secret-key-change-in-production"
);

export async function verifyTokenEdge(token: string): Promise<AuthPayloadEdge | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayloadEdge;
  } catch {
    return null;
  }
}

export async function verifyAffiliateTokenEdge(token: string): Promise<AffiliatePayloadEdge | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if ((payload as Record<string, unknown>).role !== "affiliate") return null;
    return payload as unknown as AffiliatePayloadEdge;
  } catch {
    return null;
  }
}
