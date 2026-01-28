import { NextRequest, NextResponse } from "next/server"
import { deleteSession, getSession } from "@/lib/auth"
import { logLogout } from "@/lib/audit-log"
import { getClientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // Get current session for audit logging
    const session = await getSession()
    const ip = getClientIp(request)
    const userAgent = request.headers.get("user-agent") || undefined
    
    // Log logout before deleting session
    if (session) {
      await logLogout("user", session.userId!, session.companyId, ip, userAgent)
    }
    
    // Delete ALL sessions for this user (logout from all devices)
    await deleteSession(true)
    
    // Return response with cache control headers to prevent caching
    const response = NextResponse.json({ 
      success: true,
      message: "Logged out from all devices successfully"
    })
    
    // Prevent caching of this response and any subsequent requests
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"')
    
    return response
  } catch (error) {
    console.error("Signout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


