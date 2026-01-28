"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Phone, Mail, Edit2, Calendar, Trash2, Loader2, User, Send, Wand2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EditEmployeeDialog } from "./edit-employee-dialog"

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string | null
  alternatePhone?: string | null
  photo?: string | null
  dateOfBirth?: string | null
  address?: string | null
  city?: string | null
  postcode?: string | null
  country?: string | null
  username?: string | null
  role: string | null
  employmentType: string | null
  status: string
  startDate: string | null
  endDate?: string | null
  hourlyRate?: string | null
  salary?: string | null
  paymentFrequency?: string | null
  skills?: string | null
  certifications?: string | null
  languages?: string | null
  performanceRating?: string | null
  availability?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  emergencyContactRelation?: string | null
  notes?: string | null
  createdAt: string
}

interface EmployeesListProps {
  onRefresh?: () => void
  onCountChange?: (count: number) => void
}

export function EmployeesList({ onRefresh, onCountChange }: EmployeesListProps) {
  const [search, setSearch] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [sendingCredentials, setSendingCredentials] = useState<number | null>(null)
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState<string | null>(null)
  const [generatingUsernames, setGeneratingUsernames] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/employees")
      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    onCountChange?.(employees.length)
  }, [employees.length, onCountChange])

  const handleEdit = (employee: Employee) => {
    const parsedId = Number(employee.id)
    if (!parsedId || Number.isNaN(parsedId)) {
      toast.error("Invalid employee ID. Please refresh and try again.")
      return
    }
    setEditEmployee({ ...employee, id: parsedId })
    setEditDialogOpen(true)
  }

  const handleEditSuccess = () => {
    fetchEmployees()
    onRefresh?.()
  }

  const handleDelete = async () => {
    const idValue = Number(deleteId)
    if (!idValue || Number.isNaN(idValue)) {
      setDeleteBlockedMessage("Invalid employee ID. Please refresh the page and try again.")
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/employees/${idValue}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (response.ok) {
        setEmployees(employees.filter((emp) => emp.id !== idValue))
        onRefresh?.()
        toast.success("Employee deleted successfully")
      } else {
        const message = data.error || data.message || "Failed to delete employee"
        if (response.status === 409) {
          setDeleteBlockedMessage("This employee has a running job and cannot be deleted. Reassign or complete the job first.")
        } else {
          setDeleteBlockedMessage(message)
        }
      }
    } catch (error) {
      console.error("Failed to delete employee:", error)
      toast.error("Failed to delete employee. Please try again.")
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase()
    const searchLower = search.toLowerCase()
    return (
      fullName.includes(searchLower) ||
      employee.email.toLowerCase().includes(searchLower) ||
      employee.role?.toLowerCase().includes(searchLower)
    )
  })

  const handleSendCredentials = async (employee: Employee) => {
    if (!employee.username) {
      toast.error("Employee does not have login credentials set")
      return
    }

    setSendingCredentials(employee.id)
    try {
      const response = await fetch("/api/employees/send-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: employee.id,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Credentials sent to ${employee.email}`)
      } else {
        toast.error(data.error || "Failed to send credentials")
      }
    } catch (error) {
      console.error("Failed to send credentials:", error)
      toast.error("Failed to send credentials. Please try again.")
    } finally {
      setSendingCredentials(null)
    }
  }

  // Count employees without usernames
  const employeesWithoutUsername = employees.filter(e => !e.username)

  const handleGenerateUsernames = async () => {
    if (employeesWithoutUsername.length === 0) {
      toast.info("All employees already have usernames")
      return
    }

    setGeneratingUsernames(true)
    try {
      const response = await fetch("/api/employees/generate-usernames", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || `Generated usernames for ${data.updated} employees`)
        fetchEmployees()
        onRefresh?.()
      } else {
        toast.error(data.error || "Failed to generate usernames")
      }
    } catch (error) {
      console.error("Failed to generate usernames:", error)
      toast.error("Failed to generate usernames. Please try again.")
    } finally {
      setGeneratingUsernames(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>All Employees ({employees.length})</CardTitle>
              {employeesWithoutUsername.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateUsernames}
                  disabled={generatingUsernames}
                  className="text-amber-600 border-amber-300 hover:bg-amber-50"
                >
                  {generatingUsernames ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate {employeesWithoutUsername.length} Username{employeesWithoutUsername.length > 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {employees.length === 0 ? "No employees yet. Add your first employee!" : "No employees found."}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEmployees.map((employee) => {
                const initials = `${employee.firstName[0]}${employee.lastName[0]}`

                return (
                  <Card key={employee.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            {employee.photo && <AvatarImage src={employee.photo} alt={`${employee.firstName} ${employee.lastName}`} />}
                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-semibold">
                              {employee.firstName} {employee.lastName}
                            </h4>
                            <p className="text-sm text-muted-foreground">{employee.role || "No role assigned"}</p>
                          </div>
                        </div>
                        <Badge
                          variant={employee.status === "active" ? "default" : "secondary"}
                          className={employee.status === "active" ? "bg-chart-2" : ""}
                        >
                          {employee.status}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <a href={`mailto:${employee.email}`} className="hover:text-primary truncate">
                            {employee.email}
                          </a>
                        </div>
                        {employee.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <a href={`tel:${employee.phone}`} className="hover:text-primary">
                              {employee.phone}
                            </a>
                          </div>
                        )}
                        {employee.username ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="font-mono">{employee.username}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-600">
                            <User className="h-4 w-4" />
                            <span className="text-xs italic">No username set</span>
                          </div>
                        )}
                        {employee.employmentType && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {employee.employmentType}
                          </div>
                        )}
                        {employee.startDate && (
                          <div className="text-xs text-muted-foreground">
                            Start: {new Date(employee.startDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 mt-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 bg-transparent"
                            onClick={() => handleEdit(employee)}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent text-destructive hover:text-destructive"
                            onClick={() => {
                              const parsedId = Number(employee.id)
                              if (!parsedId || Number.isNaN(parsedId)) {
                                setDeleteBlockedMessage("Invalid employee ID. Please refresh the page and try again.")
                                return
                              }
                              setDeleteId(parsedId)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full bg-transparent text-primary hover:text-primary"
                          onClick={() => handleSendCredentials(employee)}
                          disabled={sendingCredentials === employee.id || !employee.username}
                        >
                          {sendingCredentials === employee.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Credentials
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <EditEmployeeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        employee={editEmployee}
        onSuccess={handleEditSuccess}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employee? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteBlockedMessage !== null} onOpenChange={() => setDeleteBlockedMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Employee still assigned</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlockedMessage || "This employee has a running job and cannot be deleted yet."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteBlockedMessage(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
