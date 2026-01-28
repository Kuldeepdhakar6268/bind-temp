import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Public paths that don't require authentication
const publicPaths = [
  "/login", 
  "/signup", 
  "/forgot-password", 
  "/reset-password", 
  "/verify-email", 
  "/portal", 
  "/booking", 
  "/customer-portal",
  "/admin/login"
]

// Admin paths - use separate admin auth
const adminPaths = ["/admin"]

// Employee-specific paths
const employeePaths = ["/employee"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get("session_token")
  const employeeSessionToken = request.cookies.get("employee_session_token")

  // Skip auth check for API routes, static files, etc.
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Check if the path is public
  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(path + "/"))
  const isEmployeePath = employeePaths.some((path) => pathname === path || pathname.startsWith(path + "/"))
  const isAdminPath = adminPaths.some((path) => pathname === path || pathname.startsWith(path + "/"))

  // Admin routes - use separate admin session (handled by admin API routes)
  if (isAdminPath) {
    return NextResponse.next()
  }

  // Employee routes - check for employee session
  if (isEmployeePath) {
    if (!employeeSessionToken) {
      const loginUrl = new URL("/employee/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Portal routes use client-side JWT auth stored in localStorage
  if (pathname.startsWith("/portal")) {
    return NextResponse.next()
  }

  // If user is not authenticated and trying to access protected route
  if (!sessionToken && !isPublicPath) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

