import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/wages - Calculate wages based on work sessions
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Get all employees for the company
    const employeesConditions = [eq(schema.employees.companyId, session.companyId)]
    if (employeeId) employeesConditions.push(eq(schema.employees.id, parseInt(employeeId)))

    const employees = await db.query.employees.findMany({
      where: and(...employeesConditions),
    })

    // Get work sessions for each employee
    const database = db!  // We've already checked db is not null above
    const wagesData = await Promise.all(
      employees.map(async (employee) => {
        const sessionConditions: any[] = [
          eq(schema.workSessions.employeeId, employee.id),
        ]
        
        if (startDate) sessionConditions.push(gte(schema.workSessions.startedAt, new Date(startDate)))
        if (endDate) sessionConditions.push(lte(schema.workSessions.endedAt, new Date(endDate)))

        const workSessions = await database.query.workSessions.findMany({
          where: and(...sessionConditions),
        })

        // Calculate total hours and wages
        let totalMinutes = 0

        workSessions.forEach((ws) => {
          if (ws.startedAt && ws.endedAt) {
            const duration = (ws.endedAt.getTime() - ws.startedAt.getTime()) / (1000 * 60)
            totalMinutes += duration
          } else if (ws.durationMinutes) {
            totalMinutes += ws.durationMinutes
          }
        })

        const workedHours = totalMinutes / 60
        const hourlyRate = employee.hourlyRate ? parseFloat(employee.hourlyRate) : 0
        const totalWages = workedHours * hourlyRate

        return {
          employee: {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            hourlyRate: employee.hourlyRate,
          },
          totalHours: Math.round(workedHours * 100) / 100,
          totalMinutes: Math.round(totalMinutes),
          totalWages: Math.round(totalWages * 100) / 100,
          sessionsCount: workSessions.length,
        }
      })
    )

    // Calculate summary
    const summary = {
      totalEmployees: wagesData.length,
      totalHours: wagesData.reduce((sum, w) => sum + w.totalHours, 0),
      totalWages: wagesData.reduce((sum, w) => sum + w.totalWages, 0),
    }

    return NextResponse.json({
      employees: wagesData,
      summary,
    })
  } catch (error) {
    console.error("Error calculating wages:", error)
    return NextResponse.json({ error: "Failed to calculate wages" }, { status: 500 })
  }
}

