"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  MapPin,
  Users,
  Home,
  Edit,
  Trash2,
  Navigation,
  KeyRound as Pound,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns"
import { toast } from "sonner"

interface ServiceAreaApi {
  id: number
  name: string
  description: string | null
  postcodes: string | null
  city: string | null
  radius: string | null
  surchargeAmount: string | null
  surchargePercent: string | null
  isActive: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface CustomerRecord {
  id: number
  postcode: string | null
}

interface JobRecord {
  id: number
  postcode: string | null
  status: string
  assignedTo: number | null
  durationMinutes: number | null
  completedAt: string | null
  actualPrice: string | null
  estimatedPrice: string | null
}

interface ProfitabilitySummary {
  summary?: {
    totalRevenue?: number
  }
}

interface ServiceAreaStats {
  customers: number
  staff: number
  revenue: number
  avgDurationMinutes: number
}

interface ServiceAreaView extends ServiceAreaApi {
  postcodesList: string[]
  stats: ServiceAreaStats
}

function getStatusBadge(isActive: boolean) {
  if (isActive) {
    return (
      <Badge className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" /> Active
      </Badge>
    )
  }

  return (
    <Badge variant="secondary">
      <XCircle className="h-3 w-3 mr-1" /> Inactive
    </Badge>
  )
}

const AREA_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#06B6D4",
  "#84CC16",
]

export default function ServiceAreasPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [areas, setAreas] = useState<ServiceAreaApi[]>([])
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState(0)
  const [savingAreaId, setSavingAreaId] = useState<number | null>(null)

  const [newAreaName, setNewAreaName] = useState("")
  const [newAreaPostcodes, setNewAreaPostcodes] = useState("")
  const [newAreaStatus, setNewAreaStatus] = useState<"active" | "inactive">("active")

  const [postcodeInputs, setPostcodeInputs] = useState<Record<number, string>>({})
  const [editingPostcode, setEditingPostcode] = useState<{ areaId: number; index: number } | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  )

  const monthStart = useMemo(() => startOfDay(startOfMonth(new Date())), [])
  const monthEnd = useMemo(() => endOfDay(endOfMonth(new Date())), [])

  const normalizePrefix = useCallback((value: string) => value.toUpperCase().replace(/\s+/g, "").trim(), [])

  const parsePostcodesList = useCallback(
    (value: string | null) => {
      if (!value) return []
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return parsed.map((item) => normalizePrefix(String(item))).filter(Boolean)
        }
      } catch {
        // Fallback to comma-separated parsing
      }
      return value
        .split(",")
        .map((item) => normalizePrefix(item))
        .filter(Boolean)
    },
    [normalizePrefix]
  )

  const parsePostcodesInput = useCallback(
    (value: string) =>
      value
        .split(",")
        .map((item) => normalizePrefix(item))
        .filter(Boolean),
    [normalizePrefix]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const profitabilityUrl = `/api/profitability?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`
      const [areasRes, customersRes, jobsRes, profitabilityRes] = await Promise.all([
        fetch("/api/service-areas"),
        fetch("/api/customers"),
        fetch("/api/jobs?status=completed&limit=1000&sort=updatedAt"),
        fetch(profitabilityUrl),
      ])

      if (!areasRes.ok) throw new Error("Failed to fetch service areas")
      if (!customersRes.ok) throw new Error("Failed to fetch customers")
      if (!jobsRes.ok) throw new Error("Failed to fetch jobs")

      const areasPayload = await areasRes.json()
      const customersPayload = await customersRes.json()
      const jobsPayload = await jobsRes.json()

      const profitabilityPayload: ProfitabilitySummary = profitabilityRes.ok ? await profitabilityRes.json() : {}

      setAreas(Array.isArray(areasPayload) ? areasPayload : [])
      setCustomers(Array.isArray(customersPayload) ? customersPayload : [])
      setJobs(Array.isArray(jobsPayload) ? jobsPayload : [])
      setMonthlyRevenue(profitabilityPayload.summary?.totalRevenue || 0)
    } catch (error) {
      console.error("Failed to load service areas data:", error)
      toast.error("Failed to load service areas data")
    } finally {
      setLoading(false)
    }
  }, [monthEnd, monthStart])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setPostcodeInputs((prev) => {
      const next = { ...prev }
      for (const area of areas) {
        if (next[area.id] === undefined) {
          next[area.id] = ""
        }
      }
      return next
    })
  }, [areas])

  const jobsInMonth = useMemo(
    () =>
      jobs.filter((job) => {
        if (!job.completedAt) return false
        const completedAt = new Date(job.completedAt)
        return completedAt >= monthStart && completedAt <= monthEnd
      }),
    [jobs, monthEnd, monthStart]
  )

  const areasWithStats = useMemo<ServiceAreaView[]>(() => {
    const baseAreas: ServiceAreaView[] = areas.map((area) => ({
      ...area,
      postcodesList: parsePostcodesList(area.postcodes),
      stats: {
        customers: 0,
        staff: 0,
        revenue: 0,
        avgDurationMinutes: 0,
      },
    }))

    if (baseAreas.length === 0) return baseAreas

    const matchAreaId = (postcode: string | null) => {
      const normalized = normalizePrefix(postcode || "")
      if (!normalized) return null
      const match = baseAreas.find((area) =>
        area.postcodesList.some((prefix) => normalized.startsWith(prefix))
      )
      return match?.id ?? null
    }

    const customerSets = new Map<number, Set<number>>()
    const staffSets = new Map<number, Set<number>>()
    const durationTotals = new Map<number, { sum: number; count: number }>()

    for (const area of baseAreas) {
      customerSets.set(area.id, new Set<number>())
      staffSets.set(area.id, new Set<number>())
      durationTotals.set(area.id, { sum: 0, count: 0 })
    }

    for (const customer of customers) {
      const areaId = matchAreaId(customer.postcode)
      if (!areaId) continue
      customerSets.get(areaId)?.add(customer.id)
    }

    for (const job of jobsInMonth) {
      const areaId = matchAreaId(job.postcode)
      if (!areaId) continue

      const priceValue = job.actualPrice ?? job.estimatedPrice ?? "0"
      const price = Number.parseFloat(priceValue)
      if (Number.isFinite(price)) {
        const area = baseAreas.find((item) => item.id === areaId)
        if (area) {
          area.stats.revenue += price
        }
      }

      if (job.assignedTo) {
        staffSets.get(areaId)?.add(job.assignedTo)
      }

      if (job.durationMinutes && job.durationMinutes > 0) {
        const duration = durationTotals.get(areaId)
        if (duration) {
          duration.sum += job.durationMinutes
          duration.count += 1
        }
      }
    }

    return baseAreas.map((area) => {
      const duration = durationTotals.get(area.id) || { sum: 0, count: 0 }
      return {
        ...area,
        stats: {
          customers: customerSets.get(area.id)?.size || 0,
          staff: staffSets.get(area.id)?.size || 0,
          revenue: Math.round(area.stats.revenue * 100) / 100,
          avgDurationMinutes:
            duration.count > 0 ? Math.round(duration.sum / duration.count) : 0,
        },
      }
    })
  }, [areas, customers, jobsInMonth, normalizePrefix, parsePostcodesList])

  const areaById = useMemo(() => {
    const map = new Map<number, ServiceAreaView>()
    for (const area of areasWithStats) {
      map.set(area.id, area)
    }
    return map
  }, [areasWithStats])

  const areaColors = useMemo(() => {
    const map = new Map<number, string>()
    areasWithStats.forEach((area, index) => {
      map.set(area.id, AREA_COLORS[index % AREA_COLORS.length])
    })
    return map
  }, [areasWithStats])

  const getAreaColor = useCallback(
    (areaId: number, index: number) =>
      areaColors.get(areaId) || AREA_COLORS[index % AREA_COLORS.length],
    [areaColors]
  )

  const activeAreas = useMemo(
    () => areasWithStats.filter((area) => area.isActive === 1).length,
    [areasWithStats]
  )
  const totalCustomers = customers.length
  const computedRevenue = areasWithStats.reduce((sum, area) => sum + area.stats.revenue, 0)
  const totalRevenue = monthlyRevenue > 0 ? monthlyRevenue : computedRevenue

  const avgDurationMinutes = useMemo(() => {
    const durations = jobsInMonth
      .map((job) => job.durationMinutes || 0)
      .filter((minutes) => minutes > 0)
    if (durations.length === 0) return 0
    const total = durations.reduce((sum, minutes) => sum + minutes, 0)
    return Math.round(total / durations.length)
  }, [jobsInMonth])

  const updateAreaPostcodes = useCallback(async (areaId: number, nextPostcodes: string[]) => {
    setSavingAreaId(areaId)
    try {
      const res = await fetch(`/api/service-areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: nextPostcodes }),
      })
      if (!res.ok) {
        throw new Error("Failed to update postcodes")
      }
      const updated: ServiceAreaApi = await res.json()
      setAreas((prev) => prev.map((area) => (area.id === areaId ? updated : area)))
    } catch (error) {
      console.error("Failed to update postcodes:", error)
      toast.error("Failed to update postcodes")
    } finally {
      setSavingAreaId(null)
    }
  }, [])

  const handleAddPostcode = useCallback(
    async (areaId: number) => {
      const inputValue = postcodeInputs[areaId] || ""
      const additions = parsePostcodesInput(inputValue)
      if (additions.length === 0) return

      const area = areaById.get(areaId)
      if (!area) return

      const next = Array.from(new Set([...area.postcodesList, ...additions]))
      await updateAreaPostcodes(areaId, next)
      setPostcodeInputs((prev) => ({ ...prev, [areaId]: "" }))
    },
    [areaById, parsePostcodesInput, postcodeInputs, updateAreaPostcodes]
  )

  const handleDeletePostcode = useCallback(
    async (areaId: number, index: number) => {
      const area = areaById.get(areaId)
      if (!area) return
      const next = area.postcodesList.filter((_, idx) => idx !== index)
      await updateAreaPostcodes(areaId, next)
    },
    [areaById, updateAreaPostcodes]
  )

  const handleStartEditPostcode = useCallback((areaId: number, index: number, value: string) => {
    setEditingPostcode({ areaId, index })
    setEditingValue(value)
  }, [])

  const handleCancelEditPostcode = useCallback(() => {
    setEditingPostcode(null)
    setEditingValue("")
  }, [])

  const handleSaveEditPostcode = useCallback(async () => {
    if (!editingPostcode) return
    const { areaId, index } = editingPostcode
    const area = areaById.get(areaId)
    if (!area) return

    const normalized = normalizePrefix(editingValue)
    if (!normalized) {
      toast.error("Postcode cannot be empty")
      return
    }

    const next = area.postcodesList.map((item, idx) => (idx === index ? normalized : item))
    const deduped: string[] = []
    for (const item of next) {
      if (!deduped.includes(item)) deduped.push(item)
    }

    await updateAreaPostcodes(areaId, deduped)
    handleCancelEditPostcode()
  }, [areaById, editingPostcode, editingValue, handleCancelEditPostcode, normalizePrefix, updateAreaPostcodes])

  const handleCreateArea = useCallback(async () => {
    const name = newAreaName.trim()
    if (!name) {
      toast.error("Area name is required")
      return
    }

    const postcodes = parsePostcodesInput(newAreaPostcodes)
    try {
      const res = await fetch("/api/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          postcodes,
          isActive: newAreaStatus === "active",
        }),
      })
      if (!res.ok) {
        throw new Error("Failed to create service area")
      }
      setCreateDialogOpen(false)
      setNewAreaName("")
      setNewAreaPostcodes("")
      setNewAreaStatus("active")
      await loadData()
      toast.success("Service area created")
    } catch (error) {
      console.error("Failed to create service area:", error)
      toast.error("Failed to create service area")
    }
  }, [loadData, newAreaName, newAreaPostcodes, newAreaStatus, parsePostcodesInput])

  const handleDeleteArea = useCallback(
    async (areaId: number) => {
      const area = areaById.get(areaId)
      if (!area) return
      if (!confirm(`Delete service area "${area.name}"?`)) return

      try {
        const res = await fetch(`/api/service-areas/${areaId}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete service area")
        setAreas((prev) => prev.filter((item) => item.id !== areaId))
        toast.success("Service area deleted")
      } catch (error) {
        console.error("Failed to delete service area:", error)
        toast.error("Failed to delete service area")
      }
    },
    [areaById]
  )

  const renderPostcodeChip = (area: ServiceAreaView, postcode: string, index: number, compact = false) => {
    const isEditing =
      editingPostcode?.areaId === area.id && editingPostcode?.index === index
    const isSaving = savingAreaId === area.id

    if (isEditing) {
      return (
        <div key={`${area.id}-${index}-edit`} className="flex items-center gap-1">
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            className={compact ? "h-7 w-[90px] text-xs font-mono" : "h-8 w-[110px] text-xs font-mono"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleSaveEditPostcode()
              }
              if (e.key === "Escape") {
                e.preventDefault()
                handleCancelEditPostcode()
              }
            }}
            disabled={isSaving}
          />
          <Button
            type="button"
            size="sm"
            className={compact ? "h-7 px-2 text-xs" : "h-8 px-2 text-xs"}
            onClick={handleSaveEditPostcode}
            disabled={isSaving}
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={compact ? "h-7 px-2 text-xs" : "h-8 px-2 text-xs"}
            onClick={handleCancelEditPostcode}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      )
    }

    return (
      <div
        key={`${area.id}-${postcode}-${index}`}
        className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-mono"
      >
        <span>{postcode}</span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => handleStartEditPostcode(area.id, index, postcode)}
          disabled={isSaving}
          aria-label={`Edit postcode ${postcode}`}
        >
          <Edit className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => handleDeletePostcode(area.id, index)}
          disabled={isSaving}
          aria-label={`Delete postcode ${postcode}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />
      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Service Areas</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Define and manage your coverage zones</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Service Area
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Service Area</DialogTitle>
              <DialogDescription>Define a new service coverage zone</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Area Name</Label>
                <Input
                  placeholder="e.g., Central London"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Postcodes (comma separated)</Label>
                <Input
                  placeholder="EC1, EC2, EC3..."
                  value={newAreaPostcodes}
                  onChange={(e) => setNewAreaPostcodes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Enter postcode prefixes that this area covers</p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newAreaStatus} onValueChange={(value) => setNewAreaStatus(value as "active" | "inactive")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateArea} disabled={loading}>
                Add Area
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAreas}</p>
                <p className="text-sm text-muted-foreground">Active areas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-sm text-muted-foreground">Total customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Pound className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currencyFormatter.format(totalRevenue)}</p>
                <p className="text-sm text-muted-foreground">Monthly revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Navigation className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {avgDurationMinutes > 0 ? `${avgDurationMinutes} min` : "--"}
                </p>
                <p className="text-sm text-muted-foreground">Avg job duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Map */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Coverage Map</CardTitle>
            <CardDescription>Visual representation of your service areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-[4/3] sm:aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
              <img
                src="/london-service-areas-map.jpg"
                alt="London service areas map"
                className="w-full h-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Interactive Map</p>
                  <p className="text-sm text-muted-foreground">Click areas to edit coverage</p>
                </div>
              </div>
              {/* Area indicators */}
              <div className="absolute top-4 right-4 space-y-2">
                {areasWithStats
                  .filter((area) => area.isActive === 1)
                  .map((area, index) => (
                    <div key={area.id} className="flex items-center gap-2 bg-background/90 px-2 py-1 rounded text-xs">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getAreaColor(area.id, index) }}
                      />
                      <span>{area.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Areas Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Service Areas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-0">
          <div className="space-y-3 sm:hidden">
            {areasWithStats.map((area, index) => {
              const color = getAreaColor(area.id, index)
              const isSaving = savingAreaId === area.id
              const inputValue = postcodeInputs[area.id] || ""
              return (
                <div key={area.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <div>
                        <p className="text-sm font-semibold">{area.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {area.postcodesList.length > 0 ? (
                            area.postcodesList.map((postcode, pcIndex) =>
                              renderPostcodeChip(area, postcode, pcIndex)
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">No postcodes</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(area.isActive === 1)}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      value={inputValue}
                      onChange={(e) =>
                        setPostcodeInputs((prev) => ({ ...prev, [area.id]: e.target.value }))
                      }
                      placeholder="Add postcode (e.g., SW1)"
                      className="h-8 text-xs font-mono"
                      disabled={isSaving}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddPostcode(area.id)
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => handleAddPostcode(area.id)}
                      disabled={isSaving || !inputValue.trim()}
                    >
                      Add
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Home className="h-3 w-3" />
                      {area.stats.customers} customers
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {area.stats.staff} staff
                    </div>
                    <div className="flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      {area.stats.avgDurationMinutes > 0 ? `${area.stats.avgDurationMinutes} min` : "--"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Pound className="h-3 w-3" />
                      {currencyFormatter.format(area.stats.revenue)}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDeleteArea(area.id)}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <Table className="hidden sm:table">
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead>Postcodes</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Avg Duration</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areasWithStats.map((area, index) => {
                const color = getAreaColor(area.id, index)
                const isSaving = savingAreaId === area.id
                const inputValue = postcodeInputs[area.id] || ""
                return (
                  <TableRow key={area.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium">{area.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {area.postcodesList.length > 0 ? (
                          area.postcodesList.map((postcode, pcIndex) =>
                            renderPostcodeChip(area, postcode, pcIndex, true)
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">No postcodes</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          value={inputValue}
                          onChange={(e) =>
                            setPostcodeInputs((prev) => ({ ...prev, [area.id]: e.target.value }))
                          }
                          placeholder="Add postcode"
                          className="h-7 w-[120px] text-xs font-mono"
                          disabled={isSaving}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleAddPostcode(area.id)
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleAddPostcode(area.id)}
                          disabled={isSaving || !inputValue.trim()}
                        >
                          Add
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        {area.stats.customers}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {area.stats.staff}
                      </div>
                    </TableCell>
                    <TableCell>
                      {area.stats.avgDurationMinutes > 0 ? `${area.stats.avgDurationMinutes} min` : "--"}
                    </TableCell>
                    <TableCell className="font-medium">{currencyFormatter.format(area.stats.revenue)}</TableCell>
                    <TableCell>{getStatusBadge(area.isActive === 1)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteArea(area.id)}
                          disabled={isSaving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </main>
    </div>
  )
}
