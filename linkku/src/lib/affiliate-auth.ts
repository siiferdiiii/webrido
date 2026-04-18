import "server-only";

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// ─── Config ──────────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "capcut-dashboard-secret-key-change-in-production"
);
const COOKIE_NAME = "affiliate_token";
const TOKEN_EXPIRY = "30d"; // Affiliate token lasts longer

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AffiliatePayload {
  id: string;
  email: string;
  name: string;
  role: "affiliate";
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export async function signAffiliateToken(payload: AffiliatePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyAffiliateToken(token: string): Promise<AffiliatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if ((payload as Record<string, unknown>).role !== "affiliate") return null;
    return payload as unknown as AffiliatePayload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export async function setAffiliateCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function clearAffiliateCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAffiliateCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

// ─── Get current affiliate ───────────────────────────────────────────────────

export async function getAffiliateUser(): Promise<AffiliatePayload | null> {
  const token = await getAffiliateCookie();
  if (!token) return null;
  return verifyAffiliateToken(token);
}

// ─── Auth Guard (for API routes) ─────────────────────────────────────────────

export async function requireAffiliate(): Promise<
  { affiliate: AffiliatePayload; error?: never } | { affiliate?: never; error: NextResponse }
> {
  const affiliate = await getAffiliateUser();
  if (!affiliate) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // Verify affiliate still exists and is active
  const dbAffiliate = await prisma.affiliate.findUnique({
    where: { id: affiliate.id },
    select: { id: true, status: true },
  });

  if (!dbAffiliate || dbAffiliate.status !== "active") {
    return { error: NextResponse.json({ error: "Akun affiliate tidak aktif" }, { status: 401 }) };
  }

  return { affiliate };
}
