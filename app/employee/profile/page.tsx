"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  User, Mail, Phone, MapPin, Briefcase, Clock, CheckCircle, 
  Calendar, AlertCircle, Languages, Award, DollarSign, Pencil, Plus, X, Loader2, CircleDot, KeyRound
} from "lucide-react"

type EmployeeProfile = {
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
  phone: string | null
  alternatePhone: string | null
  address: string | null
  city: string | null
  postcode: string | null
  country: string | null
  dateOfBirth: string | null
  employmentType: string | null
  startDate: string | null
  hourlyRate: string | null
  skills: string | null
  certifications: string | null
  languages: string | null
  availability: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
  notes: string | null
  status: string
  company: {
    id: number
    name: string
  }
}

type Stats = {
  totalJobs: number
  completedJobs: number
  totalHours: number
  thisWeekHours: number
}

export default function EmployeeProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalJobs: 0,
    completedJobs: 0,
    totalHours: 0,
    thisWeekHours: 0,
  })

  // Edit skills/certifications state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editType, setEditType] = useState<"skills" | "certifications" | "languages">("skills")
  const [editValues, setEditValues] = useState<string[]>([])
  const [newValue, setNewValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      // Load employee profile from employee session endpoint
      const profileRes = await fetch("/api/employee/session")
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setProfile(profileData)
      }

      // Load stats
      const statsRes = await fetch("/api/employee/stats")
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        const summary = statsData?.summary ?? statsData
        setStats({
          totalJobs: summary?.totalJobs || 0,
          completedJobs: summary?.completedJobs || 0,
          totalHours: summary?.totalHoursWorked ?? summary?.totalHours ?? 0,
          thisWeekHours: summary?.thisWeekHours || 0,
        })
      }
    } catch (error) {
      console.error("Error loading profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (type: "skills" | "certifications" | "languages") => {
    setEditType(type)
    const currentValue = profile?.[type] || ""
    setEditValues(currentValue ? currentValue.split(",").map(v => v.trim()).filter(Boolean) : [])
    setNewValue("")
    setEditDialogOpen(true)
  }

  const addValue = () => {
    if (newValue.trim() && !editValues.includes(newValue.trim())) {
      setEditValues([...editValues, newValue.trim()])
      setNewValue("")
    }
  }

  const removeValue = (index: number) => {
    setEditValues(editValues.filter((_, i) => i !== index))
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [editType]: editValues.join(", "),
        }),
      })

      if (res.ok) {
        // Update local profile
        setProfile(prev => prev ? {
          ...prev,
          [editType]: editValues.join(", ")
        } : null)
        setEditDialogOpen(false)
      } else {
        const data = await res.json()
        alert(data.error || "Failed to save changes")
      }
    } catch (error) {
      console.error("Error saving changes:", error)
      alert("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  const getEditTitle = () => {
    switch (editType) {
      case "skills": return "Edit Skills"
      case "certifications": return "Edit Certifications"
      case "languages": return "Edit Languages"
    }
  }

  const getEditDescription = () => {
    switch (editType) {
      case "skills": return "Add or remove your professional skills"
      case "certifications": return "Add or remove your certifications and qualifications"
      case "languages": return "Add or remove languages you speak"
    }
  }

  const getPlaceholder = () => {
    switch (editType) {
      case "skills": return "e.g., Deep cleaning, Window cleaning, Floor polishing"
      case "certifications": return "e.g., First Aid, Health & Safety, COSHH"
      case "languages": return "e.g., English, Spanish, French"
    }
  }

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!passwordData.newPassword) {
      setPasswordError("New password is required")
      return
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setPasswordSaving(true)
    try {
      const res = await fetch("/api/employee/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordData),
      })

      const data = await res.json()

      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password")
        return
      }

      setPasswordSuccess("Password updated successfully")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      console.error("Error changing password:", error)
      setPasswordError("Failed to change password")
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-center text-muted-foreground">Failed to load profile</p>
      </div>
    )
  }

  const userInitials = `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()

  return (
    <div className="p-4 sm:p-8 space-y-6 w-full max-w-full overflow-x-hidden">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">My Profile</h1>
        <p className="text-sm sm:text-base text-muted-foreground">View your information and performance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 w-full">
        {/* Profile Info */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">
                  {profile.firstName} {profile.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize">
                    {profile.role}
                  </Badge>
                  <Badge 
                    variant={profile.status === "active" ? "default" : "secondary"}
                    className={profile.status === "active" ? "bg-green-600" : ""}
                  >
                    {profile.status}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="break-all">{profile.email}</span>
              </div>

              {profile.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.phone}</span>
                </div>
              )}

              {profile.alternatePhone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.alternatePhone} (Alternate)</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {[profile.address, profile.city, profile.postcode, profile.country]
                    .filter(Boolean)
                    .join(", ") || "Address not set"}
                </span>
              </div>

              {profile.dateOfBirth && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>DOB: {new Date(profile.dateOfBirth).toLocaleDateString()}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Joined: {profile.startDate ? new Date(profile.startDate).toLocaleDateString() : "Not set"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{profile.company.name}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>Your work statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>Total Jobs</span>
                </div>
                <p className="text-3xl font-bold">{stats.totalJobs}</p>
              </div>

              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4" />
                  <span>Completed</span>
                </div>
                <p className="text-3xl font-bold">{stats.completedJobs}</p>
              </div>

              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Total Hours</span>
                </div>
                <p className="text-3xl font-bold">{(stats.totalHours || 0).toFixed(1)}h</p>
              </div>

              <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>This Week</span>
                </div>
                <p className="text-3xl font-bold">{(stats.thisWeekHours || 0).toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Employment Details</CardTitle>
            <CardDescription>Your work arrangement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.employmentType && (
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{profile.employmentType}</span>
              </div>
            )}

            {profile.startDate && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Start Date:</span>
                <span className="font-medium">{new Date(profile.startDate).toLocaleDateString()}</span>
              </div>
            )}

            {profile.hourlyRate && (
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Hourly Rate:</span>
                <span className="font-medium">£{profile.hourlyRate}/hr</span>
              </div>
            )}

            {profile.availability && (
              <div className="flex items-center gap-3 text-sm">
                <CircleDot className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Availability:</span>
                <span className="font-medium">{profile.availability}</span>
              </div>
            )}

            {!profile.employmentType && !profile.startDate && !profile.hourlyRate && !profile.availability && (
              <p className="text-sm text-muted-foreground">No employment details recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Skills & Qualifications */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Skills & Qualifications</CardTitle>
            <CardDescription>Your expertise and certifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Skills Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="h-4 w-4" />
                  <span>Skills</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => openEditDialog("skills")}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              {profile.skills ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.split(",").map((skill, index) => (
                    <Badge key={index} variant="secondary" className="capitalize">
                      {skill.trim()}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No skills added yet</p>
              )}
            </div>

            <Separator />

            {/* Certifications Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="h-4 w-4" />
                  <span>Certifications</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => openEditDialog("certifications")}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              {profile.certifications ? (
                <div className="flex flex-wrap gap-2">
                  {profile.certifications.split(",").map((cert, index) => (
                    <Badge key={index} variant="outline" className="capitalize">
                      {cert.trim()}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No certifications added yet</p>
              )}
            </div>

            <Separator />

            {/* Languages Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Languages className="h-4 w-4" />
                  <span>Languages</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => openEditDialog("languages")}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              {profile.languages ? (
                <div className="flex flex-wrap gap-2">
                  {profile.languages.split(",").map((lang, index) => (
                    <Badge key={index} variant="secondary" className="capitalize">
                      {lang.trim()}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No languages added yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordError && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <KeyRound className="h-4 w-4" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
                  autoComplete="current-password"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="newPassword">New Password (min 8 characters)</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={passwordSaving} className="w-full sm:w-auto">
                  {passwordSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        {(profile.emergencyContactName || profile.emergencyContactPhone) && (
          <Card className="lg:col-span-2 min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Emergency Contact
              </CardTitle>
              <CardDescription>Contact in case of emergency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-6">
                {profile.emergencyContactName && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{profile.emergencyContactName}</span>
                  </div>
                )}

                {profile.emergencyContactRelation && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Relationship:</span>
                    <span className="font-medium capitalize">{profile.emergencyContactRelation}</span>
                  </div>
                )}

                {profile.emergencyContactPhone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <a href={`tel:${profile.emergencyContactPhone}`} className="font-medium text-primary hover:underline">
                      {profile.emergencyContactPhone}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Skills/Certifications/Languages Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getEditTitle()}</DialogTitle>
            <DialogDescription>{getEditDescription()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add new value */}
            <div className="flex gap-2">
              <Input
                placeholder={getPlaceholder()}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addValue()
                  }
                }}
              />
              <Button type="button" size="icon" onClick={addValue} disabled={!newValue.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Current values */}
            <div className="min-h-[100px] p-3 border rounded-lg bg-muted/30">
              {editValues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No {editType} added yet. Type above and press Enter to add.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {editValues.map((value, index) => (
                    <Badge key={index} variant="secondary" className="capitalize pr-1 flex items-center gap-1">
                      {value}
                      <button
                        type="button"
                        onClick={() => removeValue(index)}
                        className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveChanges} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
