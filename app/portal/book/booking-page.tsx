"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, ArrowRight, Calendar as CalendarIcon, Home, 
  Sparkles, CheckCircle, Loader2, User, Mail, Phone, MapPin 
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const SERVICE_TYPES = [
  { value: "regular", label: "Regular Cleaning", description: "Standard cleaning service", basePrice: 50 },
  { value: "deep_clean", label: "Deep Cleaning", description: "Thorough deep cleaning", basePrice: 120 },
  { value: "move_in", label: "Move In Cleaning", description: "Prepare your new home", basePrice: 150 },
  { value: "move_out", label: "Move Out Cleaning", description: "Leave your old place spotless", basePrice: 150 },
  { value: "one_time", label: "One-Time Clean", description: "Single cleaning session", basePrice: 70 },
  { value: "spring_clean", label: "Spring Cleaning", description: "Seasonal deep refresh", basePrice: 180 },
]

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment/Flat" },
  { value: "house", label: "House" },
  { value: "studio", label: "Studio" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
]

const TIME_SLOTS = [
  { value: "morning", label: "Morning (8am - 12pm)" },
  { value: "afternoon", label: "Afternoon (12pm - 5pm)" },
  { value: "evening", label: "Evening (5pm - 8pm)" },
  { value: "flexible", label: "Flexible" },
]

const FREQUENCIES = [
  { value: "one_time", label: "One Time" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
]

interface FormData {
  // Customer Info
  firstName: string
  lastName: string
  email: string
  phone: string
  // Service Location
  address: string
  addressLine2: string
  city: string
  postcode: string
  accessInstructions: string
  // Service Details
  serviceType: string
  propertyType: string
  bedrooms: string
  bathrooms: string
  squareFootage: string
  hasSpecialRequirements: boolean
  specialRequirements: string
  // Scheduling
  preferredDate: Date | undefined
  preferredTimeSlot: string
  alternateDate: Date | undefined
  frequency: string
}

interface Company {
  id: number
  name: string
  city: string | null
  logo: string | null
}

export default function BookingPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const companyIdParam = searchParams.get("company")
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [customer, setCustomer] = useState<any>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companyIdParam || "")
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    addressLine2: "",
    city: "",
    postcode: "",
    accessInstructions: "",
    serviceType: "",
    propertyType: "",
    bedrooms: "",
    bathrooms: "",
    squareFootage: "",
    hasSpecialRequirements: false,
    specialRequirements: "",
    preferredDate: undefined,
    preferredTimeSlot: "",
    alternateDate: undefined,
    frequency: "one_time",
  })

  // Check if logged in customer and fetch full profile - requires login
  useEffect(() => {
    const fetchCustomerProfile = async () => {
      const customerData = localStorage.getItem("customer_data")
      const token = localStorage.getItem("customer_token")
      
      // Require login - redirect if not authenticated
      if (!customerData || !token) {
        router.push("/portal")
        return
      }
      
      const parsed = JSON.parse(customerData)
      setCustomer(parsed)
        
      // Fetch full customer profile to get all saved data
      try {
        const response = await fetch("/api/customer-portal/profile", {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const profile = await response.json()
          setFormData(prev => ({
            ...prev,
            firstName: profile.firstName || parsed.firstName || "",
            lastName: profile.lastName || parsed.lastName || "",
            email: profile.email || parsed.email || "",
            phone: profile.phone || "",
            address: profile.address || "",
            addressLine2: profile.addressLine2 || "",
            city: profile.city || "",
            postcode: profile.postcode || "",
            accessInstructions: profile.accessInstructions || "",
          }))
        } else {
          // Fallback to localStorage data
          setFormData(prev => ({
            ...prev,
            firstName: parsed.firstName || "",
            lastName: parsed.lastName || "",
            email: parsed.email || "",
            phone: parsed.phone || "",
            address: parsed.address || "",
            city: parsed.city || "",
            postcode: parsed.postcode || "",
          }))
        }
      } catch (error) {
        console.error("Failed to fetch customer profile:", error)
      }
    }
    fetchCustomerProfile()
  }, [router])

  // Fetch available companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch("/api/public/companies")
        if (response.ok) {
          const data = await response.json()
          setCompanies(data)
          // Auto-select if only one company or if company param provided
          if (data.length === 1) {
            setSelectedCompanyId(data[0].id.toString())
          } else if (companyIdParam && data.some((c: Company) => c.id.toString() === companyIdParam)) {
            setSelectedCompanyId(companyIdParam)
          }
        }
      } catch (error) {
        console.error("Failed to fetch companies:", error)
      } finally {
        setLoadingCompanies(false)
      }
    }
    fetchCompanies()
  }, [companyIdParam])

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const calculateEstimate = () => {
    const service = SERVICE_TYPES.find(s => s.value === formData.serviceType)
    if (!service) return 0
    
    let price = service.basePrice
    const bedrooms = parseInt(formData.bedrooms) || 0
    const bathrooms = parseInt(formData.bathrooms) || 0
    
    // Add per bedroom/bathroom
    price += bedrooms * 15
    price += bathrooms * 10
    
    return price
  }

  const validateStep = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return formData.firstName && formData.lastName && formData.email && formData.phone
      case 2:
        return formData.address && formData.city && formData.postcode
      case 3:
        return formData.serviceType && formData.propertyType
      case 4:
        return formData.preferredDate && formData.preferredTimeSlot
      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1)
      setError("")
    } else {
      setError("Please fill in all required fields")
    }
  }

  const prevStep = () => {
    setStep(step - 1)
    setError("")
  }

  const handleSubmit = async () => {
    if (!selectedCompanyId) {
      setError("Please select a cleaning company")
      return
    }
    
    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("customer_token")
      
      const response = await fetch("/api/booking-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyId: parseInt(selectedCompanyId),
          customerId: customer?.id || null,
          customerFirstName: formData.firstName,
          customerLastName: formData.lastName,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          address: formData.address,
          addressLine2: formData.addressLine2,
          city: formData.city,
          postcode: formData.postcode,
          accessInstructions: formData.accessInstructions,
          serviceType: formData.serviceType,
          propertyType: formData.propertyType,
          bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
          bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
          squareFootage: formData.squareFootage ? parseInt(formData.squareFootage) : null,
          hasSpecialRequirements: formData.hasSpecialRequirements ? 1 : 0,
          specialRequirements: formData.specialRequirements,
          preferredDate: formData.preferredDate?.toISOString(),
          preferredTimeSlot: formData.preferredTimeSlot,
          alternateDate: formData.alternateDate?.toISOString(),
          frequency: formData.frequency,
          estimatedPrice: calculateEstimate(),
          source: customer ? "portal" : "website",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit booking request")
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Booking Request Submitted!</CardTitle>
            <CardDescription>
              Thank you for your request. We&apos;ll review your booking and get back to you within 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-left">
              <h4 className="font-medium mb-2">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• We&apos;ll review your cleaning requirements</li>
                <li>• You&apos;ll receive a confirmation email</li>
                <li>• We&apos;ll contact you to confirm the date and time</li>
                <li>• A cleaner will be assigned to your booking</li>
              </ul>
            </div>
            
            {customer ? (
              <Button onClick={() => router.push("/portal/dashboard")} className="w-full">
                Go to Dashboard
              </Button>
            ) : (
              <div className="space-y-2">
                <Button onClick={() => router.push("/portal")} className="w-full">
                  Login to Track Your Booking
                </Button>
                <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                  Back to Home
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href={customer ? "/portal/dashboard" : "/"} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
          <h1 className="text-3xl font-bold">Book a Cleaning</h1>
          <p className="text-muted-foreground mt-2">Complete the form below to request a cleaning service</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors",
                s < step ? "bg-green-600 text-white" :
                s === step ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              )}>
                {s < step ? <CheckCircle className="h-5 w-5" /> : s}
              </div>
              {s < 5 && (
                <div className={cn(
                  "h-1 w-8 md:w-16 transition-colors",
                  s < step ? "bg-green-600" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && "Your Information"}
              {step === 2 && "Service Location"}
              {step === 3 && "Service Details"}
              {step === 4 && "Preferred Schedule"}
              {step === 5 && "Review & Submit"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Tell us how to contact you"}
              {step === 2 && "Where should we clean?"}
              {step === 3 && "What type of cleaning do you need?"}
              {step === 4 && "When would you like us to come?"}
              {step === 5 && "Review your booking details"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Selection - Show if multiple companies or none selected */}
            {loadingCompanies ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading companies...</span>
              </div>
            ) : companies.length === 0 ? (
              <Alert variant="destructive">
                <AlertDescription>
                  No cleaning companies are currently available. Please try again later.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Company Selector - always show at top if multiple companies */}
                {companies.length > 1 && (
                  <div className="space-y-2 pb-4 border-b">
                    <Label htmlFor="company">Select Cleaning Company *</Label>
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a cleaning company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id.toString()}>
                            {company.name}{company.city ? ` - ${company.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Show selected company info */}
                {selectedCompanyId && companies.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 mb-2">
                    <p className="text-sm font-medium">
                      Booking with: {companies.find(c => c.id.toString() === selectedCompanyId)?.name}
                    </p>
                  </div>
                )}

            {/* Step 1: Customer Info */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateFormData("firstName", e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateFormData("lastName", e.target.value)}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                    placeholder="+44 7xxx xxxxxx"
                  />
                </div>
              </>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateFormData("address", e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Flat/Unit Number</Label>
                  <Input
                    id="addressLine2"
                    value={formData.addressLine2}
                    onChange={(e) => updateFormData("addressLine2", e.target.value)}
                    placeholder="Flat 2B"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateFormData("city", e.target.value)}
                      placeholder="London"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode *</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => updateFormData("postcode", e.target.value)}
                      placeholder="SW1A 1AA"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessInstructions">Access Instructions</Label>
                  <Textarea
                    id="accessInstructions"
                    value={formData.accessInstructions}
                    onChange={(e) => updateFormData("accessInstructions", e.target.value)}
                    placeholder="e.g., Ring doorbell twice, key under mat, buzzer code is 1234"
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Step 3: Service Details */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Service Type *</Label>
                  <div className="grid gap-3">
                    {SERVICE_TYPES.map((service) => (
                      <div
                        key={service.value}
                        className={cn(
                          "p-4 border rounded-lg cursor-pointer transition-colors",
                          formData.serviceType === service.value
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/50"
                        )}
                        onClick={() => {
                          updateFormData("serviceType", service.value)
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{service.label}</h4>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                          </div>
                          <span className="text-sm font-medium">from A?{service.basePrice}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Property Type *</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(value) => updateFormData("propertyType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select property type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">Bedrooms</Label>
                    <Select
                      value={formData.bedrooms}
                      onValueChange={(value) => updateFormData("bedrooms", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">Bathrooms</Label>
                    <Select
                      value={formData.bathrooms}
                      onValueChange={(value) => updateFormData("bathrooms", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="squareFootage">Size (sqft)</Label>
                    <Input
                      id="squareFootage"
                      type="number"
                      value={formData.squareFootage}
                      onChange={(e) => updateFormData("squareFootage", e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasSpecialRequirements"
                      checked={formData.hasSpecialRequirements}
                      onCheckedChange={(checked) => updateFormData("hasSpecialRequirements", checked)}
                    />
                    <Label htmlFor="hasSpecialRequirements">I have special requirements</Label>
                  </div>
                  {formData.hasSpecialRequirements && (
                    <Textarea
                      value={formData.specialRequirements}
                      onChange={(e) => updateFormData("specialRequirements", e.target.value)}
                      placeholder="e.g., Pet-friendly products only, focus on kitchen, allergies to certain cleaning products"
                      rows={3}
                    />
                  )}
                </div>
              </>
            )}

            {/* Step 4: Schedule */}
            {step === 4 && (
              <>
                <div className="space-y-2">
                  <Label>Preferred Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.preferredDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.preferredDate ? format(formData.preferredDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.preferredDate}
                        onSelect={(date) => updateFormData("preferredDate", date)}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Time *</Label>
                  <Select
                    value={formData.preferredTimeSlot}
                    onValueChange={(value) => updateFormData("preferredTimeSlot", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a time slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot.value} value={slot.value}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Alternate Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.alternateDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.alternateDate ? format(formData.alternateDate, "PPP") : "Pick an alternate date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.alternateDate}
                        onSelect={(date) => updateFormData("alternateDate", date)}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => updateFormData("frequency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="How often?" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <>
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      Contact Information
                    </h4>
                    <p className="text-sm">{formData.firstName} {formData.lastName}</p>
                    <p className="text-sm text-muted-foreground">{formData.email}</p>
                    <p className="text-sm text-muted-foreground">{formData.phone}</p>
                  </div>
                  
                  <div className="bg-muted rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4" />
                      Service Location
                    </h4>
                    <p className="text-sm">{formData.address}</p>
                    {formData.addressLine2 && <p className="text-sm">{formData.addressLine2}</p>}
                    <p className="text-sm">{formData.city}, {formData.postcode}</p>
                    {formData.accessInstructions && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Access: {formData.accessInstructions}
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-muted rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4" />
                      Service Details
                    </h4>
                    <p className="text-sm">{SERVICE_TYPES.find(s => s.value === formData.serviceType)?.label || formData.serviceType}</p>
                    <p className="text-sm text-muted-foreground">
                      {PROPERTY_TYPES.find(p => p.value === formData.propertyType)?.label}
                      {formData.bedrooms && ` • ${formData.bedrooms} bed`}
                      {formData.bathrooms && ` • ${formData.bathrooms} bath`}
                    </p>
                    {formData.specialRequirements && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Special: {formData.specialRequirements}
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-muted rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <CalendarIcon className="h-4 w-4" />
                      Schedule
                    </h4>
                    <p className="text-sm">
                      {formData.preferredDate && format(formData.preferredDate, "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {TIME_SLOTS.find(t => t.value === formData.preferredTimeSlot)?.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {FREQUENCIES.find(f => f.value === formData.frequency)?.label}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium">Estimated Price</span>
                    <span className="font-bold text-primary">£{calculateEstimate()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    * Final price may vary based on actual requirements. We&apos;ll confirm the exact price before starting.
                  </p>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              {step > 1 ? (
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              
              {step < 5 ? (
                <Button onClick={nextStep} disabled={!selectedCompanyId}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading || !selectedCompanyId}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Booking Request
                </Button>
              )}
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
