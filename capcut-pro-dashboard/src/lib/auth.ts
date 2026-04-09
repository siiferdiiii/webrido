import "server-only"; // Prevent this file from being imported in Client Components

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Re-export shared constants so server code can still import from "@/lib/auth"
export { ALL_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS } from "@/lib/auth-shared";
export type { PermissionKey } from "@/lib/auth-shared";

// ─── Config ──────────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "capcut-dashboard-secret-key-change-in-production"
);
const COOKIE_NAME = "admin_token";
const TOKEN_EXPIRY = "7d";

// ─── Types ───────────────────────────────────────────────────────────────────

import type { PermissionKey } from "@/lib/auth-shared";

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
  role: "developer" | "admin";
}

export interface AdminUserWithPermissions {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  permissions: Record<PermissionKey, boolean> | null;
  createdAt: Date | null;
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

// ─── Get current user ────────────────────────────────────────────────────────

export async function getAuthUser(): Promise<AuthPayload | null> {
  const token = await getAuthCookie();
  if (!token) return null;
  return verifyToken(token);
}

// ─── Permission checking ──────────────────────────────────────────────────────

export function hasPermission(
  user: AuthPayload,
  permissions: Record<string, boolean> | null,
  key: PermissionKey
): boolean {
  if (user.role === "developer") return true;
  if (!permissions) return false;
  return permissions[key] === true;
}

// ─── Auth Guards (for API routes) ────────────────────────────────────────────

export async function requireAuth(): Promise<{ user: AuthPayload; error?: never } | { user?: never; error: NextResponse }> {
  const user = await getAuthUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const dbUser = await prisma.adminUser.findUnique({ where: { id: user.id } });
  if (!dbUser || dbUser.status !== "active") {
    return { error: NextResponse.json({ error: "Akun tidak aktif atau tidak ditemukan" }, { status: 401 }) };
  }
  return { user };
}

export async function requireDeveloper(): Promise<{ user: AuthPayload; error?: never } | { user?: never; error: NextResponse }> {
  const result = await requireAuth();
  if ("error" in result) return result;
  if (result.user.role !== "developer") {
    return { error: NextResponse.json({ error: "Forbidden: Developer only" }, { status: 403 }) };
  }
  return { user: result.user };
}

export async function requirePermission(key: PermissionKey): Promise<{ user: AuthPayload; error?: never } | { user?: never; error: NextResponse }> {
  const result = await requireAuth();
  if ("error" in result) return result;
  const { user } = result;

  if (user.role === "developer") return { user };

  const dbUser = await prisma.adminUser.findUnique({ where: { id: user.id } });
  const perms = dbUser?.permissions as Record<string, boolean> | null;
  if (!perms || !perms[key]) {
    return { error: NextResponse.json({ error: "Akses ditolak: izin tidak mencukupi" }, { status: 403 }) };
  }
  return { user };
}
