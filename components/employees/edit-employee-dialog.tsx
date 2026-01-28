"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { AddressAutocomplete, AddressSuggestion } from "@/components/addresses/address-autocomplete"

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  alternatePhone?: string | null
  photo?: string | null
  dateOfBirth?: string | null
  address?: string | null
  city?: string | null
  postcode?: string | null
  country?: string | null
  role?: string | null
  employmentType?: string | null
  status: string
  startDate?: string | null
  endDate?: string | null
  hourlyRate?: string | null
  salary?: string | null
  paymentFrequency?: string | null
  payType?: string | null
  skills?: string | null
  certifications?: string | null
  languages?: string | null
  performanceRating?: string | null
  availability?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  emergencyContactRelation?: string | null
  notes?: string | null
}

interface EditEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  onSuccess?: () => void
}

export function EditEmployeeDialog({ open, onOpenChange, employee, onSuccess }: EditEmployeeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    alternatePhone: "",
    photo: "",
    dateOfBirth: "",
    address: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
    role: "",
    employmentType: "",
    status: "active",
    startDate: "",
    endDate: "",
    hourlyRate: "",
    salary: "",
    paymentFrequency: "",
    payType: "hourly",
    skills: "",
    certifications: "",
    languages: "",
    performanceRating: "",
    availability: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    notes: "",
  })

  // Load employee data when dialog opens
  useEffect(() => {
    if (employee) {
      setFormData({
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        phone: employee.phone || "",
        alternatePhone: employee.alternatePhone || "",
        photo: employee.photo || "",
        dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split("T")[0] : "",
        address: employee.address || "",
        city: employee.city || "",
        postcode: employee.postcode || "",
        country: employee.country || "United Kingdom",
        role: employee.role || "",
        employmentType: employee.employmentType || "",
        status: employee.status || "active",
        startDate: employee.startDate ? employee.startDate.split("T")[0] : "",
        endDate: employee.endDate ? employee.endDate.split("T")[0] : "",
        hourlyRate: employee.hourlyRate || "",
        salary: employee.salary || "",
        paymentFrequency: employee.paymentFrequency || "",
        payType: employee.payType || (employee.salary ? "salary" : "hourly"),
        skills: employee.skills || "",
        certifications: employee.certifications || "",
        languages: employee.languages || "",
        performanceRating: employee.performanceRating || "",
        availability: employee.availability || "",
        emergencyContactName: employee.emergencyContactName || "",
        emergencyContactPhone: employee.emergencyContactPhone || "",
        emergencyContactRelation: employee.emergencyContactRelation || "",
        notes: employee.notes || "",
      })
    }
  }, [employee])

  const handleChange = (field: string, value: string) => {
    // Limit phone number length to 17 characters (UK format)
    if ((field === "phone" || field === "alternatePhone" || field === "emergencyContactPhone") && value.length > 17) {
      return
    }

    setFormData({ ...formData, [field]: value })
  }

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.address || prev.address,
      city: suggestion.city || prev.city,
      postcode: suggestion.postcode || prev.postcode,
      country: suggestion.country || prev.country || "United Kingdom",
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee?.id || Number.isNaN(employee.id)) {
      setError("Invalid employee ID. Please refresh the page and try again.")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update employee")
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (!employee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="flex w-full flex-wrap gap-2 h-auto bg-transparent p-0 sm:grid sm:grid-cols-5 sm:gap-0 sm:bg-muted sm:p-[3px] sm:h-9">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="compensation">Pay</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="emergency">Emergency</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+44 20 1234 5678"
                    maxLength={17}
                  />
                  <p className="text-xs text-muted-foreground">UK phone number (max 17 characters)</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alternatePhone">Alternate Phone</Label>
                  <Input
                    id="alternatePhone"
                    type="tel"
                    value={formData.alternatePhone}
                    onChange={(e) => handleChange("alternatePhone", e.target.value)}
                    placeholder="+44 7700 900123"
                    maxLength={17}
                  />
                  <p className="text-xs text-muted-foreground">UK phone number (max 17 characters)</p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <AddressAutocomplete
                  id="address"
                  value={formData.address}
                  onChange={(value) => handleChange("address", value)}
                  onSelect={handleAddressSelect}
                  placeholder="123 High Street"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="London"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={formData.postcode}
                    onChange={(e) => handleChange("postcode", e.target.value)}
                    placeholder="SW1A 1AA"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    placeholder="United Kingdom"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="photo">Photo URL</Label>
                <Input
                  id="photo"
                  value={formData.photo}
                  onChange={(e) => handleChange("photo", e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                />
                <p className="text-xs text-muted-foreground">Enter a URL to the employee&apos;s photo</p>
              </div>
            </TabsContent>

            <TabsContent value="employment" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value) => handleChange("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cleaner">Cleaner</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select
                    value={formData.employmentType}
                    onValueChange={(value) => handleChange("employmentType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on-leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="performanceRating">Performance Rating (0-5)</Label>
                  <Input
                    id="performanceRating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.performanceRating}
                    onChange={(e) => handleChange("performanceRating", e.target.value)}
                    placeholder="4.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleChange("startDate", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleChange("endDate", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Additional notes about the employee..."
                  rows={3}
                />
              </div>
            </TabsContent>

                        <TabsContent value="compensation" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="payType">Pay Type</Label>
                <Select
                  value={formData.payType}
                  onValueChange={(value) => handleChange("payType", value)}
                >
                  <SelectTrigger id="payType">
                    <SelectValue placeholder="Select pay type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="per_job">Pay Per Job</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formData.payType === "hourly" && (
                  <div className="grid gap-2">
                    <Label htmlFor="hourlyRate">Hourly Rate (GBP)</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourlyRate}
                      onChange={(e) => handleChange("hourlyRate", e.target.value)}
                      placeholder="15.50"
                    />
                  </div>
                )}
                {formData.payType === "salary" && (
                  <div className="grid gap-2">
                    <Label htmlFor="salary">Annual Salary (GBP)</Label>
                    <Input
                      id="salary"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.salary}
                      onChange={(e) => handleChange("salary", e.target.value)}
                      placeholder="30000"
                    />
                  </div>
                )}
              </div>

              {formData.payType !== "per_job" && (
                <div className="grid gap-2">
                  <Label htmlFor="paymentFrequency">Payment Frequency</Label>
                  <Select
                    value={formData.paymentFrequency}
                    onValueChange={(value) => handleChange("paymentFrequency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Hourly workers use hourly rate. Salaried employees use annual salary.
                  Pay-per-job employees get pay set per job.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="skills" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="skills">Skills</Label>
                <Textarea
                  id="skills"
                  value={formData.skills}
                  onChange={(e) => handleChange("skills", e.target.value)}
                  placeholder="e.g., Deep cleaning, Window cleaning, Carpet cleaning (comma-separated)"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Enter skills separated by commas</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="certifications">Certifications</Label>
                <Textarea
                  id="certifications"
                  value={formData.certifications}
                  onChange={(e) => handleChange("certifications", e.target.value)}
                  placeholder="e.g., COSHH Training, First Aid, Health & Safety (comma-separated)"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Enter certifications separated by commas</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="languages">Languages</Label>
                <Textarea
                  id="languages"
                  value={formData.languages}
                  onChange={(e) => handleChange("languages", e.target.value)}
                  placeholder="e.g., English, Spanish, Polish (comma-separated)"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">Enter languages separated by commas</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="availability">Availability</Label>
                <Textarea
                  id="availability"
                  value={formData.availability}
                  onChange={(e) => handleChange("availability", e.target.value)}
                  placeholder="e.g., Mon-Fri: 9am-5pm, Sat: 10am-2pm"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Enter weekly availability schedule</p>
              </div>
            </TabsContent>

            <TabsContent value="emergency" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleChange("emergencyContactName", e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleChange("emergencyContactPhone", e.target.value)}
                  placeholder="+44 7700 900123"
                  maxLength={17}
                />
                <p className="text-xs text-muted-foreground">UK phone number (max 17 characters)</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="emergencyContactRelation">Relationship</Label>
                <Input
                  id="emergencyContactRelation"
                  value={formData.emergencyContactRelation}
                  onChange={(e) => handleChange("emergencyContactRelation", e.target.value)}
                  placeholder="Spouse, Parent, Sibling, etc."
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> Emergency contact information is kept confidential and will only
                  be used in case of emergencies.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


