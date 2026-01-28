"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, Copy, CheckCircle2, Mail } from "lucide-react"
import { isValidUKPhone } from "@/lib/phone-validation"
import { AddressAutocomplete, AddressSuggestion } from "@/components/addresses/address-autocomplete"

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddEmployeeDialog({ open, onOpenChange, onSuccess }: AddEmployeeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState<{ username: boolean; password: boolean }>({ username: false, password: false })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [employeeEmail, setEmployeeEmail] = useState("")
  const [employeeName, setEmployeeName] = useState("")
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
    role: "",
    employmentType: "",
    startDate: "",
    payType: "hourly",
    hourlyRate: "",
    salary: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    // Limit phone number length to 17 characters (UK format: +44 7700 900123 = 16 chars max)
    if (name === "phone" && value.length > 17) {
      return
    }

    setFormData({ ...formData, [name]: value })
    setError("")
  }

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.address || prev.address,
      city: suggestion.city || prev.city,
      postcode: suggestion.postcode || prev.postcode,
      country: suggestion.country || prev.country || "United Kingdom",
    }))
    setError("")
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

      try {
        if (!isValidUKPhone(formData.phone)) {
          throw new Error("Phone must be a valid UK number (07xxx xxxxxx or 01xxx xxxxxx)")
        }
        if (!formData.address || !formData.city || !formData.postcode || !formData.country) {
          throw new Error("Address, city, postcode, and country are required")
        }
        if (formData.payType === "hourly" && !formData.hourlyRate) {
          throw new Error("Hourly rate is required for hourly pay type")
        }
        if (formData.payType === "salary" && !formData.salary) {
          throw new Error("Salary is required for salaried employees")
        }

        const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add employee")
      }

      // Show credentials dialog
      setCredentials({
        username: data.username,
        password: data.plainPassword,
      })
      setEmployeeEmail(formData.email)
      setEmployeeName(`${formData.firstName} ${formData.lastName}`)
      setShowCredentials(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleSendCredentials = async () => {
    if (!credentials || !employeeEmail) return

    setSendingEmail(true)
    try {
      const response = await fetch("/api/employees/send-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: employeeEmail,
          employeeName: employeeName,
          username: credentials.username,
          password: credentials.password,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to send credentials")
      }

      setEmailSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email")
    } finally {
      setSendingEmail(false)
    }
  }

  const handleCloseCredentials = () => {
    setShowCredentials(false)
    setCredentials(null)
    setShowPassword(false)
    setCopied({ username: false, password: false })
    setEmailSent(false)
    setEmployeeEmail("")
    setEmployeeName("")

    // Reset form
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postcode: "",
      country: "United Kingdom",
      role: "",
      employmentType: "",
      startDate: "",
      payType: "hourly",
      hourlyRate: "",
      salary: "",
    })

    onSuccess?.()
    onOpenChange(false)
  }

  const copyToClipboard = async (text: string, type: "username" | "password") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied((prev) => ({ ...prev, [type]: true }))
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [type]: false }))
      }, 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+44 7700 900000"
                  maxLength={17}
                  required
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">UK phone number (max 17 characters)</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">
                Address <span className="text-destructive">*</span>
              </Label>
              <AddressAutocomplete
                id="address"
                name="address"
                value={formData.address}
                onChange={(value) => {
                  setFormData((prev) => ({ ...prev, address: value }))
                  setError("")
                }}
                onSelect={handleAddressSelect}
                placeholder="123 High Street"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="London"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="postcode">
                  Postcode <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                  placeholder="SW1A 1AA"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="country">
                Country <span className="text-destructive">*</span>
              </Label>
              <Input
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="United Kingdom"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.role} onValueChange={(value) => handleSelectChange("role", value)} required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaner">Cleaner</SelectItem>
                    <SelectItem value="senior">Senior Cleaner</SelectItem>
                    <SelectItem value="leader">Team Leader</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employmentType">
                  Employment Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(value) => handleSelectChange("employmentType", value)}
                  required
                >
                  <SelectTrigger id="employmentType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]}
                required
              />
              <p className="text-xs text-muted-foreground">Start date cannot be in the past</p>
            </div>

            <div className="grid gap-4 rounded-lg border p-4">
              <div className="grid gap-2">
                <Label htmlFor="payType">
                  Pay Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.payType}
                  onValueChange={(value) => handleSelectChange("payType", value)}
                  required
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

              {formData.payType === "hourly" && (
                <div className="grid gap-2">
                  <Label htmlFor="hourlyRate">
                    Hourly Rate (£) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="hourlyRate"
                    name="hourlyRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourlyRate}
                    onChange={handleChange}
                    placeholder="15.50"
                    required
                  />
                </div>
              )}

              {formData.payType === "salary" && (
                <div className="grid gap-2">
                  <Label htmlFor="salary">
                    Annual Salary (£) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="salary"
                    name="salary"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.salary}
                    onChange={handleChange}
                    placeholder="30000"
                    required
                  />
                </div>
              )}

              {formData.payType === "per_job" && (
                <p className="text-xs text-muted-foreground">
                  Pay will be set per job when scheduling. Employees on salary will not see job pay details.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Employee"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Credentials Success Dialog */}
      <Dialog open={showCredentials} onOpenChange={handleCloseCredentials}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Employee Added Successfully!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertDescription className="text-sm">
                Save these credentials! The password will not be shown again.
              </AlertDescription>
            </Alert>

            {credentials && (
              <div className="space-y-4">
                {/* Username */}
                <div className="space-y-2">
                  <Label>Username</Label>
                  <div className="flex items-center gap-2">
                    <Input value={credentials.username} readOnly className="font-mono" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(credentials.username, "username")}
                    >
                      {copied.username ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={credentials.password}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(credentials.password, "password")}
                    >
                      {copied.password ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Email sent confirmation */}
            {emailSent && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Credentials have been sent to {employeeEmail}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleSendCredentials}
              disabled={sendingEmail || emailSent}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : emailSent ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  Sent
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Credentials
                </>
              )}
            </Button>
            <Button onClick={handleCloseCredentials}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
