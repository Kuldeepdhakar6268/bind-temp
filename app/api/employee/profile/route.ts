import { NextRequest, NextResponse } from "next/server"
import { getEmployeeSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { employees } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * PATCH /api/employee/profile
 * Update the current employee's profile (skills, certifications, languages)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 })
    }

    const body = await request.json()
    const { skills, certifications, languages } = body

    // Validate - only allow these fields to be updated
    const updateData: Partial<{ skills: string; certifications: string; languages: string }> = {}
    
    if (skills !== undefined) {
      updateData.skills = skills
    }
    if (certifications !== undefined) {
      updateData.certifications = certifications
    }
    if (languages !== undefined) {
      updateData.languages = languages
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Update employee
    await db
      .update(employees)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, session.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Employee profile update error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
