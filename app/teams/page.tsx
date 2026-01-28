"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Plus, Trash2, Pencil } from "lucide-react"
import { toast } from "sonner"

interface EmployeeOption {
  id: number
  firstName: string
  lastName: string
  email: string
  status?: string | null
}

interface TeamMember {
  id?: number
  teamId?: number
  employeeId: number
  employee?: EmployeeOption
}

interface Team {
  id: number
  name: string
  description?: string | null
  members?: TeamMember[]
  createdAt?: string
  updatedAt?: string
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState("")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.trim()
      const nameB = `${b.firstName} ${b.lastName}`.trim()
      return nameA.localeCompare(nameB)
    })
  }, [employees])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [teamsRes, employeesRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/employees?status=active"),
      ])

      const teamsPayload = teamsRes.ok ? await teamsRes.json() : []
      const employeesPayload = employeesRes.ok ? await employeesRes.json() : []

      setTeams(Array.isArray(teamsPayload) ? teamsPayload : [])
      setEmployees(Array.isArray(employeesPayload) ? employeesPayload : [])
    } catch (error) {
      console.error("Failed to load teams:", error)
      toast.error("Failed to load teams")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreateDialog = () => {
    setEditingTeam(null)
    setTeamName("")
    setSelectedEmployeeIds([])
    setDialogOpen(true)
  }

  const openEditDialog = (team: Team) => {
    setEditingTeam(team)
    setTeamName(team.name)
    const memberIds = (team.members || [])
      .map((member) => member.employeeId)
      .filter((id): id is number => Number.isFinite(id))
    setSelectedEmployeeIds(memberIds)
    setDialogOpen(true)
  }

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    )
  }

  const handleSave = async () => {
    const name = teamName.trim()
    if (!name) {
      toast.error("Team name is required")
      return
    }
    if (selectedEmployeeIds.length < 2) {
      toast.error("Teams must have at least 2 employees")
      return
    }

    setSaving(true)
    try {
      const payload = {
        name,
        employeeIds: selectedEmployeeIds,
      }

      const res = await fetch(editingTeam ? `/api/teams/${editingTeam.id}` : "/api/teams", {
        method: editingTeam ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const message = (await res.json())?.error || "Failed to save team"
        throw new Error(message)
      }

      toast.success(editingTeam ? "Team updated" : "Team created")
      setDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error("Failed to save team:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save team")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (team: Team) => {
    if (!confirm(`Delete team "${team.name}"?`)) return
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" })
      if (!res.ok) {
        const message = (await res.json())?.error || "Failed to delete team"
        throw new Error(message)
      }
      toast.success("Team deleted")
      setTeams((prev) => prev.filter((item) => item.id !== team.id))
    } catch (error) {
      console.error("Failed to delete team:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete team")
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeaderClient />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Teams</h1>
            <p className="text-sm text-muted-foreground">
              Create teams and assign multiple employees to each group.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Team
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTeam ? "Edit Team" : "Create Team"}</DialogTitle>
              <DialogDescription>Give the team a name and select employees.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Team Name</Label>
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" />
              </div>
              <div className="space-y-2">
                <Label>Team Members</Label>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Select at least 2 employees.
                  </p>
                  {sortedEmployees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active employees found.</p>
                  ) : (
                    sortedEmployees.map((emp) => {
                      const fullName = `${emp.firstName} ${emp.lastName}`.trim()
                      return (
                        <label key={emp.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedEmployeeIds.includes(emp.id)}
                            onCheckedChange={() => toggleEmployee(emp.id)}
                          />
                          <span className="font-medium">{fullName}</span>
                          <span className="text-xs text-muted-foreground">{emp.email}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingTeam ? "Save Changes" : "Create Team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Loading teams...</p>
              </CardContent>
            </Card>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">No teams created yet.</p>
              </CardContent>
            </Card>
          ) : (
            teams.map((team) => {
              const members = team.members || []
              return (
                <Card key={team.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{team.name}</span>
                      <Badge variant="secondary">{members.length} members</Badge>
                    </CardTitle>
                    <CardDescription>
                      {team.description || "Manage the employees assigned to this team."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {members.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No members assigned.</span>
                      ) : (
                        members.map((member) => (
                          <Badge key={`${team.id}-${member.employeeId}`} variant="outline">
                            {member.employee
                              ? `${member.employee.firstName} ${member.employee.lastName}`.trim()
                              : `Employee #${member.employeeId}`}
                          </Badge>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(team)}>
                        <Pencil className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(team)}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {!loading && teams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Overview
              </CardTitle>
              <CardDescription>Quick glance at all team sizes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {teams.map((team) => (
                  <Badge key={`summary-${team.id}`} variant="secondary">
                    {team.name}: {(team.members || []).length}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
