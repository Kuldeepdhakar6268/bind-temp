"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2, Check, Cloud, Lock } from "lucide-react"
import { toast } from "sonner"
import { AddressAutocomplete, AddressSuggestion } from "@/components/addresses/address-autocomplete"

// UK Phone validation: must be 10-11 digits after +44
const formatUKPhone = (value: string): string => {
  // Remove all non-digits except the leading +
  let digits = value.replace(/[^\d]/g, "")
  
  // Remove leading 44 or 0 if present (we'll add +44)
  if (digits.startsWith("44")) {
    digits = digits.slice(2)
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1)
  }
  
  // Limit to 10 digits (UK mobile/landline without country code)
  digits = digits.slice(0, 10)
  
  // Format with +44 prefix
  if (digits.length === 0) return ""
  return `+44 ${digits}`
}

const validateUKPhone = (phone: string): boolean => {
  if (!phone) return true // Empty is valid (not required)
  const digits = phone.replace(/[^\d]/g, "")
  // Should have 10-11 digits total (with or without leading 0)
  return digits.length >= 10 && digits.length <= 11
}

// UK VAT validation: GB followed by 9 or 12 digits, or GB followed by GD/HA + 3 digits
const formatUKVAT = (value: string): string => {
  // Remove all non-alphanumeric
  let cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "")
  
  // Add GB prefix if not present
  if (!cleaned.startsWith("GB")) {
    cleaned = "GB" + cleaned.replace(/^GB/i, "")
  }
  
  // Limit length (GB + max 12 digits = 14 chars)
  cleaned = cleaned.slice(0, 14)
  
  return cleaned
}

const validateUKVAT = (vat: string): boolean => {
  if (!vat) return true // Empty is valid (not required)
  
  // Standard VAT: GB + 9 digits or GB + 12 digits
  // Government dept: GBGD + 3 digits
  // Health authority: GBHA + 3 digits
  const patterns = [
    /^GB\d{9}$/,      // Standard 9 digit
    /^GB\d{12}$/,     // Standard 12 digit (branch)
    /^GBGD\d{3}$/,    // Government department
    /^GBHA\d{3}$/,    // Health authority
  ]
  
  return patterns.some(pattern => pattern.test(vat))
}

export function CompanyProfileForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
    website: "",
    businessType: "residential",
    taxId: "",
    numberOfEmployees: 1,
  })

  useEffect(() => {
    fetchCompanyData()
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const fetchCompanyData = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/company/profile")
      if (response.ok) {
        const data = await response.json()
        setFormData({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          city: data.city || "",
          postcode: data.postcode || "",
          country: data.country || "United Kingdom",
          website: data.website || "",
          businessType: data.businessType || "residential",
          taxId: data.taxId || "",
          numberOfEmployees: data.numberOfEmployees || 1,
        })
      }
    } catch (err) {
      toast.error("Failed to load company data")
    } finally {
      setLoading(false)
    }
  }

  const saveData = useCallback(async (data: typeof formData) => {
    setSaving(true)
    try {
      const response = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error("Failed to save")
      }

      setLastSaved(new Date())
    } catch (err) {
      toast.error("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }, [])

  const applyFormUpdate = (nextData: typeof formData) => {
    setFormData(nextData)

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (nextData.phone && !validateUKPhone(nextData.phone)) {
      return
    }
    if (nextData.taxId && !validateUKVAT(nextData.taxId)) {
      return
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveData(nextData)
    }, 1000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value = e.target.value
    const name = e.target.name
    
    // Apply formatting for specific fields
    if (name === "phone") {
      value = formatUKPhone(value)
    } else if (name === "taxId") {
      value = formatUKVAT(value)
    }
    
    const newData = { ...formData, [name]: value }
    applyFormUpdate(newData)
  }

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    const nextData = {
      ...formData,
      address: suggestion.address || formData.address,
      city: suggestion.city || formData.city,
      postcode: suggestion.postcode || formData.postcode,
      country: suggestion.country || formData.country || "United Kingdom",
    }
    applyFormUpdate(nextData)
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle>Company Information</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4" />
                <span>Auto-save enabled</span>
              </>
            )}
          </div>
        </div>
        <CardDescription>Update your company details and business information. Changes are saved automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  Company Email *
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                  title="Company email cannot be changed"
                />
                <p className="text-xs text-muted-foreground">Contact support to change your company email</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+44 7123456789"
                />
                <p className="text-xs text-muted-foreground">UK format: +44 followed by 10 digits</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                id="address"
                name="address"
                value={formData.address}
                onChange={(value) => applyFormUpdate({ ...formData, address: value })}
                onSelect={handleAddressSelect}
                placeholder="123 High Street"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">VAT/Tax ID</Label>
                <Input
                  id="taxId"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleChange}
                  placeholder="GB123456789"
                  maxLength={14}
                />
                <p className="text-xs text-muted-foreground">UK VAT format: GB + 9 digits</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <select
                  id="businessType"
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="residential">Residential Cleaning</option>
                  <option value="commercial">Commercial Cleaning</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfEmployees">Number of Employees</Label>
                <Input
                  id="numberOfEmployees"
                  name="numberOfEmployees"
                  type="number"
                  min="1"
                  value={formData.numberOfEmployees}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

