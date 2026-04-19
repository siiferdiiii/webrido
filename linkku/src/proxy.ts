import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge, verifyAffiliateTokenEdge } from "@/lib/auth-edge";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/api/webhook",
  "/api/webhook/orderkuota",
  "/api/webhook/midtrans",
  "/api/cron",
  // Affiliate public paths
  "/affiliate/login",
  "/affiliate/setup",
  "/api/affiliate-portal/auth/login",
  "/api/affiliate-portal/auth/setup",
  // Customer order pages (public — accessed via transaction ID)
  "/order",
  "/api/order",
  // Marketplace / Checkout (public)
  "/marketplace",
  "/api/checkout",
  "/api/products",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths (exact matches or startsWith)
  if (pathname === "/" || PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // ── Affiliate Portal Routes ──────────────────────────────────────────────
  // IMPORTANT: Must NOT match /affiliates (admin page). Only match:
  //   /affiliate (exact), /affiliate/*, /api/affiliate-portal/*
  const isAffiliatePortal = pathname === "/affiliate" || pathname.startsWith("/affiliate/") || pathname.startsWith("/api/affiliate-portal");
  if (isAffiliatePortal) {
    const token = req.cookies.get("affiliate_token")?.value;

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/affiliate/login", req.url));
    }

    const affiliate = await verifyAffiliateTokenEdge(token);
    if (!affiliate) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });
      }
      const res = NextResponse.redirect(new URL("/affiliate/login", req.url));
      res.cookies.delete("affiliate_token");
      return res;
    }

    return NextResponse.next();
  }

  // ── Admin Routes (existing behavior) ─────────────────────────────────────
  const token = req.cookies.get("admin_token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const user = await verifyTokenEdge(token);
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("admin_token");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
