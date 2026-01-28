import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { and, desc, eq, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth"

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teams = await db.query.teams.findMany({
      where: eq(schema.teams.companyId, session.companyId),
      orderBy: [desc(schema.teams.createdAt)],
    })

    if (teams.length === 0) {
      return NextResponse.json([])
    }

    const teamIds = teams.map((team) => team.id)

    const members = await db
      .select({
        id: schema.teamMembers.id,
        teamId: schema.teamMembers.teamId,
        employeeId: schema.teamMembers.employeeId,
        employee: {
          id: schema.employees.id,
          firstName: schema.employees.firstName,
          lastName: schema.employees.lastName,
          email: schema.employees.email,
        },
      })
      .from(schema.teamMembers)
      .leftJoin(schema.employees, eq(schema.teamMembers.employeeId, schema.employees.id))
      .where(
        and(
          inArray(schema.teamMembers.teamId, teamIds),
          eq(schema.employees.companyId, session.companyId)
        )
      )

    const membersByTeam = new Map<number, typeof members>()
    for (const member of members) {
      if (!membersByTeam.has(member.teamId)) {
        membersByTeam.set(member.teamId, [])
      }
      membersByTeam.get(member.teamId)?.push(member)
    }

    const payload = teams.map((team) => ({
      ...team,
      members: membersByTeam.get(team.id) || [],
    }))

    return NextResponse.json(payload)
  } catch (error) {
    console.error("Error fetching teams:", error)
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const description = body?.description ? String(body.description) : null
    const employeeIds: number[] = Array.isArray(body?.employeeIds)
      ? body.employeeIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
      : []

    if (!name) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 })
    }

    const uniqueEmployeeIds = Array.from(new Set(employeeIds))

    if (uniqueEmployeeIds.length < 2) {
      return NextResponse.json({ error: "Teams must have at least 2 employees" }, { status: 400 })
    }

    const existingTeams = await db.query.teams.findMany({
      columns: { id: true, name: true },
      where: eq(schema.teams.companyId, session.companyId),
    })

    if (existingTeams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 })
    }

    if (uniqueEmployeeIds.length > 0) {
      const employees = await db.query.employees.findMany({
        columns: { id: true },
        where: and(
          eq(schema.employees.companyId, session.companyId),
          inArray(schema.employees.id, uniqueEmployeeIds)
        ),
      })

      if (employees.length !== uniqueEmployeeIds.length) {
        return NextResponse.json({ error: "One or more employees are invalid" }, { status: 400 })
      }
    }

    if (existingTeams.length > 0) {
      const existingMembers = await db
        .select({
          teamId: schema.teamMembers.teamId,
          employeeId: schema.teamMembers.employeeId,
        })
        .from(schema.teamMembers)
        .leftJoin(schema.teams, eq(schema.teamMembers.teamId, schema.teams.id))
        .where(eq(schema.teams.companyId, session.companyId))

      const membersByTeam = new Map<number, number[]>()
      for (const member of existingMembers) {
        if (!membersByTeam.has(member.teamId)) {
          membersByTeam.set(member.teamId, [])
        }
        membersByTeam.get(member.teamId)?.push(member.employeeId)
      }

      const nextKey = uniqueEmployeeIds.slice().sort((a, b) => a - b).join(",")
      for (const team of existingTeams) {
        const members = membersByTeam.get(team.id) || []
        const teamKey = members.slice().sort((a, b) => a - b).join(",")
        if (teamKey && teamKey === nextKey) {
          return NextResponse.json(
            { error: "A team with the same members already exists" },
            { status: 400 }
          )
        }
      }
    }

    const [team] = await db
      .insert(schema.teams)
      .values({
        companyId: session.companyId,
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (uniqueEmployeeIds.length > 0) {
      await db.insert(schema.teamMembers).values(
        uniqueEmployeeIds.map((employeeId) => ({
          teamId: team.id,
          employeeId,
          createdAt: new Date(),
        }))
      )
    }

    return NextResponse.json(
      {
        ...team,
        members: uniqueEmployeeIds.map((employeeId) => ({
          employeeId,
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating team:", error)
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 })
  }
}
