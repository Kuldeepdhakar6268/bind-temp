import { NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { isNull, eq, or } from "drizzle-orm"

// Generate a username from first and last name
function generateUsername(firstName: string, lastName: string, existingUsernames: Set<string>): string {
  // Clean and lowercase the names
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "")
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "")
  
  // Try different username formats
  const candidates = [
    `${cleanFirst}.${cleanLast}`,                    // john.doe
    `${cleanFirst}${cleanLast}`,                     // johndoe
    `${cleanFirst[0]}${cleanLast}`,                  // jdoe
    `${cleanFirst}${cleanLast[0]}`,                  // johnd
    `${cleanFirst}.${cleanLast}${Math.floor(Math.random() * 100)}`, // john.doe42
  ]
  
  for (const candidate of candidates) {
    if (!existingUsernames.has(candidate)) {
      existingUsernames.add(candidate)
      return candidate
    }
  }
  
  // If all else fails, add a random number
  let username = `${cleanFirst}.${cleanLast}${Date.now() % 1000}`
  while (existingUsernames.has(username)) {
    username = `${cleanFirst}.${cleanLast}${Math.floor(Math.random() * 10000)}`
  }
  existingUsernames.add(username)
  return username
}

// GET - List employees without usernames
export async function GET() {
  try {
    const session = await requireAuth()

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    // Get all employees without usernames for this company
    const employeesWithoutUsername = await db.query.employees.findMany({
      where: (employees, { and, or, isNull, eq }) => and(
        eq(employees.companyId, session.companyId),
        or(isNull(employees.username), eq(employees.username, ""))
      ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    return NextResponse.json({
      count: employeesWithoutUsername.length,
      employees: employeesWithoutUsername,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error fetching employees without usernames:", error)
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 })
  }
}

// POST - Generate usernames for employees without them
export async function POST() {
  try {
    const session = await requireAuth()

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    // Only allow admin/owner
    if (session.role !== "admin" && session.role !== "owner") {
      return NextResponse.json({ error: "Only admins can generate usernames" }, { status: 403 })
    }

    // Get all employees without usernames for this company
    const employeesWithoutUsername = await db.query.employees.findMany({
      where: (employees, { and, or, isNull, eq }) => and(
        eq(employees.companyId, session.companyId),
        or(isNull(employees.username), eq(employees.username, ""))
      ),
    })

    if (employeesWithoutUsername.length === 0) {
      return NextResponse.json({
        message: "All employees already have usernames",
        updated: 0,
        employees: [],
      })
    }

    // Get all existing usernames for this company
    const existingEmployees = await db.query.employees.findMany({
      where: (employees, { and, isNotNull, eq, ne }) => and(
        eq(employees.companyId, session.companyId),
        isNotNull(employees.username),
        ne(employees.username, "")
      ),
      columns: {
        username: true,
      },
    })

    // Build set of existing usernames
    const existingUsernames = new Set<string>(
      existingEmployees.map(e => e.username!.toLowerCase())
    )

    // Generate and update usernames
    const updates: Array<{ id: number; name: string; username: string }> = []

    for (const employee of employeesWithoutUsername) {
      const username = generateUsername(employee.firstName, employee.lastName, existingUsernames)
      
      // Update the employee
      await db
        .update(schema.employees)
        .set({ 
          username, 
          updatedAt: new Date() 
        })
        .where(eq(schema.employees.id, employee.id))
      
      updates.push({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        username,
      })
    }

    return NextResponse.json({
      message: `Generated usernames for ${updates.length} employees`,
      updated: updates.length,
      employees: updates,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error generating usernames:", error)
    return NextResponse.json({ error: "Failed to generate usernames" }, { status: 500 })
  }
}
