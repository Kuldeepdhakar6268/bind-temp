import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { and, eq, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const teamId = Number(id)
    if (!Number.isFinite(teamId)) {
      return NextResponse.json({ error: "Invalid team id" }, { status: 400 })
    }

    const existing = await db.query.teams.findFirst({
      where: and(eq(schema.teams.id, teamId), eq(schema.teams.companyId, session.companyId)),
    })

    if (!existing) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const body = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const name = body?.name ? String(body.name).trim() : null
    const description = body?.description ? String(body.description) : null
    if (name) updateData.name = name
    if (body?.description !== undefined) updateData.description = description

    const employeeIds: number[] | null = Array.isArray(body?.employeeIds)
      ? body.employeeIds.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value))
      : null

    if (employeeIds) {
      if (employeeIds.length < 2) {
        return NextResponse.json({ error: "Teams must have at least 2 employees" }, { status: 400 })
      }

      const uniqueIds = Array.from(new Set(employeeIds))
      const employees = await db.query.employees.findMany({
        columns: { id: true },
        where: and(
          eq(schema.employees.companyId, session.companyId),
          inArray(schema.employees.id, uniqueIds)
        ),
      })
      if (employees.length !== uniqueIds.length) {
        return NextResponse.json({ error: "One or more employees are invalid" }, { status: 400 })
      }
    }

    if (name) {
      const nameExists = await db.query.teams.findFirst({
        columns: { id: true },
        where: and(
          eq(schema.teams.companyId, session.companyId),
          eq(schema.teams.name, name)
        ),
      })
      if (nameExists && nameExists.id !== teamId) {
        return NextResponse.json({ error: "A team with this name already exists" }, { status: 400 })
      }
    }

    if (employeeIds) {
      const existingTeams = await db.query.teams.findMany({
        columns: { id: true },
        where: eq(schema.teams.companyId, session.companyId),
      })

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

      const nextKey = employeeIds.slice().sort((a, b) => a - b).join(",")
      for (const team of existingTeams) {
        if (team.id === teamId) continue
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

    const [updated] = await db
      .update(schema.teams)
      .set(updateData)
      .where(eq(schema.teams.id, teamId))
      .returning()

    if (employeeIds) {
      await db.delete(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId))
      const uniqueIds = Array.from(new Set(employeeIds))
      if (uniqueIds.length > 0) {
        await db.insert(schema.teamMembers).values(
          uniqueIds.map((employeeId) => ({
            teamId,
            employeeId,
            createdAt: new Date(),
          }))
        )
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating team:", error)
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const teamId = Number(id)
    if (!Number.isFinite(teamId)) {
      return NextResponse.json({ error: "Invalid team id" }, { status: 400 })
    }

    const existing = await db.query.teams.findFirst({
      where: and(eq(schema.teams.id, teamId), eq(schema.teams.companyId, session.companyId)),
    })

    if (!existing) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await db.delete(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId))
    await db.delete(schema.teams).where(eq(schema.teams.id, teamId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting team:", error)
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 })
  }
}
