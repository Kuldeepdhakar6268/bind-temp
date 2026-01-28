"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { isValidUKPhone } from "@/lib/phone-validation"
import { AddressAutocomplete, AddressSuggestion } from "@/components/addresses/address-autocomplete"

type AdditionalAddress = {
  key: string
  id?: number
  label: string
  address: string
  addressLine2: string
  city: string
  postcode: string
  country: string
  accessInstructions: string
  parkingInstructions: string
  specialInstructions: string
}

interface Customer {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  alternatePhone?: string | null
  customerType: string
  address?: string | null
  addressLine2?: string | null
  city?: string | null
  postcode?: string | null
  country?: string | null
  billingAddress?: string | null
  billingCity?: string | null
  billingPostcode?: string | null
  billingCountry?: string | null
  companyName?: string | null
  businessType?: string | null
  taxId?: string | null
  preferredContactMethod?: string | null
  specialInstructions?: string | null
  accessInstructions?: string | null
  parkingInstructions?: string | null
  source?: string | null
  referredBy?: string | null
  notes?: string | null
  status: string
  addresses?: Array<{
    id?: number
    label?: string | null
    address: string
    addressLine2?: string | null
    city?: string | null
    postcode?: string | null
    country?: string | null
    accessInstructions?: string | null
    parkingInstructions?: string | null
    specialInstructions?: string | null
  }>
}

interface EditCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSuccess?: () => void
}

export function EditCustomerDialog({ open, onOpenChange, customer, onSuccess }: EditCustomerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [billingDifferent, setBillingDifferent] = useState(false)
  const [additionalAddresses, setAdditionalAddresses] = useState<AdditionalAddress[]>([])
  const addressKeyCounter = useRef(0)

  const nextAddressKey = (id?: number, index?: number) => {
    if (typeof id === "number") {
      return `addr-${id}-${index ?? 0}`
    }
    const next = addressKeyCounter.current
    addressKeyCounter.current += 1
    return `new-${next}`
  }

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    alternatePhone: "",
    customerType: "residential",
    address: "",
    addressLine2: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
    billingAddress: "",
    billingCity: "",
    billingPostcode: "",
    billingCountry: "United Kingdom",
    companyName: "",
    businessType: "",
    taxId: "",
    preferredContactMethod: "email",
    specialInstructions: "",
    accessInstructions: "",
    parkingInstructions: "",
    source: "",
    referredBy: "",
    notes: "",
    status: "active",
  })

  // Load customer data when dialog opens
  useEffect(() => {
    if (customer) {
      setCustomerId(typeof customer.id === "number" ? customer.id : Number(customer.id))
      const nextFormData = {
        firstName: customer.firstName || "",
        lastName: customer.lastName || "",
        email: customer.email || "",
        phone: customer.phone || "",
        alternatePhone: customer.alternatePhone || "",
        customerType: customer.customerType || "residential",
        address: customer.address || "",
        addressLine2: customer.addressLine2 || "",
        city: customer.city || "",
        postcode: customer.postcode || "",
        country: customer.country || "United Kingdom",
        billingAddress: customer.billingAddress || "",
        billingCity: customer.billingCity || "",
        billingPostcode: customer.billingPostcode || "",
        billingCountry: customer.billingCountry || "United Kingdom",
        companyName: customer.companyName || "",
        businessType: customer.businessType || "",
        taxId: customer.taxId || "",
        preferredContactMethod: customer.preferredContactMethod || "email",
        specialInstructions: customer.specialInstructions || "",
        accessInstructions: customer.accessInstructions || "",
        parkingInstructions: customer.parkingInstructions || "",
        source: customer.source || "",
        referredBy: customer.referredBy || "",
        notes: customer.notes || "",
        status: customer.status || "active",
      }

      setFormData(nextFormData)
      const hasBilling = Boolean(
        nextFormData.billingAddress ||
          nextFormData.billingCity ||
          nextFormData.billingPostcode ||
          nextFormData.billingCountry
      )
      const billingMatches =
        nextFormData.billingAddress === nextFormData.address &&
        nextFormData.billingCity === nextFormData.city &&
        nextFormData.billingPostcode === nextFormData.postcode &&
        nextFormData.billingCountry === nextFormData.country
      setBillingDifferent(hasBilling && !billingMatches)

      // Load additional addresses
        if (customer.addresses && customer.addresses.length > 0) {
          setAdditionalAddresses(
            customer.addresses.map((addr, index) => ({
              key: nextAddressKey(addr.id, index),
              id: addr.id,
              label: addr.label || "",
              address: addr.address || "",
              addressLine2: addr.addressLine2 || "",
              city: addr.city || "",
              postcode: addr.postcode || "",
              country: addr.country || "United Kingdom",
              accessInstructions: addr.accessInstructions || "",
              parkingInstructions: addr.parkingInstructions || "",
              specialInstructions: addr.specialInstructions || "",
            }))
          )
      } else {
        setAdditionalAddresses([])
      }
    } else {
      setCustomerId(null)
      setAdditionalAddresses([])
    }
  }, [customer])

  const syncBillingAddress = (nextData: typeof formData) => {
    if (billingDifferent) return nextData

    const sameAddress =
      nextData.billingAddress === nextData.address &&
      nextData.billingCity === nextData.city &&
      nextData.billingPostcode === nextData.postcode &&
      nextData.billingCountry === nextData.country

    if (sameAddress) return nextData

    return {
      ...nextData,
      billingAddress: nextData.address,
      billingCity: nextData.city,
      billingPostcode: nextData.postcode,
      billingCountry: nextData.country,
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => syncBillingAddress({ ...prev, [field]: value }))
  }

  const handlePrimaryAddressSelect = (suggestion: AddressSuggestion) => {
    setFormData((prev) =>
      syncBillingAddress({
        ...prev,
        address: suggestion.address || prev.address,
        addressLine2: prev.addressLine2 || suggestion.addressLine2 || "",
        city: suggestion.city || prev.city,
        postcode: suggestion.postcode || prev.postcode,
        country: suggestion.country || prev.country || "United Kingdom",
      })
    )
  }

  const handleBillingAddressSelect = (suggestion: AddressSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      billingAddress: suggestion.address || prev.billingAddress,
      billingCity: suggestion.city || prev.billingCity,
      billingPostcode: suggestion.postcode || prev.billingPostcode,
      billingCountry: suggestion.country || prev.billingCountry || "United Kingdom",
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return

    setError("")
    setLoading(true)

    try {
      if (!Number.isFinite(customerId)) {
        throw new Error("Invalid customer ID")
      }
      if (!formData.phone) {
        throw new Error("Phone number is required")
      }
      if (!isValidUKPhone(formData.phone)) {
        throw new Error("Phone must be a valid UK number (07xxx xxxxxx or 01xxx xxxxxx)")
      }
      if (!formData.address || !formData.city || !formData.postcode || !formData.country) {
        throw new Error("Address, city, postcode, and country are required")
      }
      if (billingDifferent) {
        if (!formData.billingAddress || !formData.billingCity || !formData.billingPostcode || !formData.billingCountry) {
          throw new Error("Billing address, city, postcode, and country are required")
        }
      }
      if (additionalAddresses.some((addr) => !addr.address || !addr.city || !addr.postcode || !addr.country)) {
        throw new Error("Additional addresses need address, city, postcode, and country")
      }

      const response = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...syncBillingAddress(formData),
          additionalAddresses: additionalAddresses.map((addr) => ({
            id: addr.id,
            label: addr.label.trim() || null,
            address: addr.address.trim(),
            addressLine2: addr.addressLine2.trim() || null,
            city: addr.city.trim(),
            postcode: addr.postcode.trim(),
            country: addr.country.trim(),
            accessInstructions: addr.accessInstructions.trim() || null,
            parkingInstructions: addr.parkingInstructions.trim() || null,
            specialInstructions: addr.specialInstructions.trim() || null,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update customer")
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="customerType">Customer Type</Label>
                  <Select value={formData.customerType} onValueChange={(value) => handleChange("customerType", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">
                    Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+44 20 1234 5678"
                    maxLength={17}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alternatePhone">Alternate Phone</Label>
                  <Input
                    id="alternatePhone"
                    type="tel"
                    value={formData.alternatePhone}
                    onChange={(e) => handleChange("alternatePhone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="source">Source</Label>
                  <Select value={formData.source} onValueChange={(value) => handleChange("source", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
                      <SelectItem value="advertisement">Advertisement</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="referredBy">Referred By</Label>
                  <Input
                    id="referredBy"
                    value={formData.referredBy}
                    onChange={(e) => handleChange("referredBy", e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="business" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">For commercial customers only</p>

              <div className="grid gap-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Input
                    id="businessType"
                    value={formData.businessType}
                    onChange={(e) => handleChange("businessType", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="taxId">VAT Number / Tax ID</Label>
                  <Input id="taxId" value={formData.taxId} onChange={(e) => handleChange("taxId", e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="preferredContactMethod">Preferred Contact Method</Label>
                <Select
                  value={formData.preferredContactMethod}
                  onValueChange={(value) => handleChange("preferredContactMethod", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Internal Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4">
              <div className="grid gap-2">
                <Label htmlFor="address">
                  Address Line 1 <span className="text-destructive">*</span>
                </Label>
                <AddressAutocomplete
                  id="address"
                  value={formData.address}
                  onChange={(value) => handleChange("address", value)}
                  onSelect={handlePrimaryAddressSelect}
                  placeholder="123 High Street"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={formData.addressLine2}
                  onChange={(e) => handleChange("addressLine2", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postcode">
                    Postcode <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="postcode"
                    value={formData.postcode}
                    onChange={(e) => handleChange("postcode", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">
                    Country <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    placeholder="United Kingdom"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="accessInstructions">Access Instructions</Label>
                <Textarea
                  id="accessInstructions"
                  value={formData.accessInstructions}
                  onChange={(e) => handleChange("accessInstructions", e.target.value)}
                  placeholder="How to access the property (e.g., key location, gate code)"
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="parkingInstructions">Parking Instructions</Label>
                <Textarea
                  id="parkingInstructions"
                  value={formData.parkingInstructions}
                  onChange={(e) => handleChange("parkingInstructions", e.target.value)}
                  placeholder="Where to park"
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="specialInstructions">Special Instructions</Label>
                <Textarea
                  id="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={(e) => handleChange("specialInstructions", e.target.value)}
                  placeholder="Any special requirements or preferences"
                  rows={2}
                />
              </div>

              {/* Additional Addresses Section */}
              <div className="border-t pt-4 mt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">Additional Addresses</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAdditionalAddresses((prev) => [
                        ...prev,
                        {
                          key: nextAddressKey(),
                          label: "",
                          address: "",
                          addressLine2: "",
                          city: "",
                          postcode: "",
                          country: "United Kingdom",
                          accessInstructions: "",
                          parkingInstructions: "",
                          specialInstructions: "",
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add address
                  </Button>
                </div>
                {additionalAddresses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No additional addresses.</p>
                ) : (
                  <div className="space-y-3">
                    {additionalAddresses.map((addr, index) => (
                      <div key={addr.key} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs text-muted-foreground">Address {index + 2}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setAdditionalAddresses((prev) => prev.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          <Label>Label</Label>
                          <Input
                            value={addr.label}
                            onChange={(e) =>
                              setAdditionalAddresses((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item))
                              )
                            }
                            placeholder="e.g., Office, Holiday Home"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Address Line 1</Label>
                          <AddressAutocomplete
                            value={addr.address}
                            onChange={(value) =>
                              setAdditionalAddresses((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, address: value } : item))
                              )
                            }
                            onSelect={(suggestion) =>
                              setAdditionalAddresses((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        address: suggestion.address || item.address,
                                        addressLine2: item.addressLine2 || suggestion.addressLine2 || "",
                                        city: suggestion.city || item.city,
                                        postcode: suggestion.postcode || item.postcode,
                                        country: suggestion.country || item.country || "United Kingdom",
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="123 High Street"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Address Line 2</Label>
                          <Input
                            value={addr.addressLine2}
                            onChange={(e) =>
                              setAdditionalAddresses((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, addressLine2: e.target.value } : item))
                              )
                            }
                            placeholder="Apartment, suite, etc."
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="grid gap-2">
                            <Label>City</Label>
                            <Input
                              value={addr.city}
                              onChange={(e) =>
                                setAdditionalAddresses((prev) =>
                                  prev.map((item, i) => (i === index ? { ...item, city: e.target.value } : item))
                                )
                              }
                              placeholder="London"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Postcode</Label>
                            <Input
                              value={addr.postcode}
                              onChange={(e) =>
                                setAdditionalAddresses((prev) =>
                                  prev.map((item, i) => (i === index ? { ...item, postcode: e.target.value } : item))
                                )
                              }
                              placeholder="SW1A 1AA"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Country</Label>
                            <Input
                              value={addr.country}
                              onChange={(e) =>
                                setAdditionalAddresses((prev) =>
                                  prev.map((item, i) => (i === index ? { ...item, country: e.target.value } : item))
                                )
                              }
                              placeholder="United Kingdom"
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Access Instructions</Label>
                          <Textarea
                            value={addr.accessInstructions}
                            onChange={(e) =>
                              setAdditionalAddresses((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, accessInstructions: e.target.value } : item))
                              )
                            }
                            placeholder="How to access the property (e.g., key location, gate code)"
                            rows={2}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Parking Instructions</Label>
                          <Textarea
                            value={addr.parkingInstructions}
                            onChange={(e) =>
                              setAdditionalAddresses((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, parkingInstructions: e.target.value } : item))
                              )
                            }
                            placeholder="Where to park"
                            rows={2}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Special Instructions</Label>
                          <Textarea
                            value={addr.specialInstructions}
                            onChange={(e) =>
                              setAdditionalAddresses((prev) =>
                                prev.map((item, i) => (i === index ? { ...item, specialInstructions: e.target.value } : item))
                              )
                            }
                            placeholder="Any special requirements or preferences"
                            rows={2}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Billing Address (if different)</h4>
                <div className="flex items-center gap-3 border-2 border-muted rounded-md p-3 mb-4">
                  <Checkbox
                    checked={billingDifferent}
                    onCheckedChange={(checked) => setBillingDifferent(Boolean(checked))}
                    className="h-5 w-5 border-2"
                  />
                  <Label className="cursor-pointer">Billing address is different</Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <AddressAutocomplete
                    id="billingAddress"
                    value={formData.billingAddress}
                    onChange={(value) => handleChange("billingAddress", value)}
                    onSelect={handleBillingAddressSelect}
                    placeholder="Leave blank if same as service address"
                    disabled={!billingDifferent}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div className="grid gap-2">
                    <Label htmlFor="billingCity">City</Label>
                    <Input
                      id="billingCity"
                      value={formData.billingCity}
                      onChange={(e) => handleChange("billingCity", e.target.value)}
                      disabled={!billingDifferent}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="billingPostcode">Postcode</Label>
                    <Input
                      id="billingPostcode"
                      value={formData.billingPostcode}
                      onChange={(e) => handleChange("billingPostcode", e.target.value)}
                      disabled={!billingDifferent}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="billingCountry">Country</Label>
                    <Input
                      id="billingCountry"
                      value={formData.billingCountry}
                      onChange={(e) => handleChange("billingCountry", e.target.value)}
                      placeholder="United Kingdom"
                      disabled={!billingDifferent}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Customer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
