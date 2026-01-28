"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Calendar as CalendarIcon,
  ArrowLeft,
  Briefcase,
  CreditCard,
  AlertCircle,
  ChevronRight,
  Wallet,
  PiggyBank,
  BarChart3
} from "lucide-react"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"

type Job = {
  id: number
  title: string
  customer: string | null
  scheduledFor: string | null
  completedAt: string | null
  durationMinutes: number
  planEstimatedDuration?: string | null
  estimatedPrice: string | null
  actualPrice: string | null
  status: string
  location: string
  earnings: number
  isPaid: boolean
}

type Payout = {
  id: number
  amount: string
  currency: string
  periodStart: string
  periodEnd: string
  jobCount: number
  status: string
  paymentMethod: string | null
  paidAt: string | null
  createdAt: string
}

type FinanceData = {
  employee: {
    id: number
    name: string
    hourlyRate: number
  }
  period: {
    start: string
    end: string
  }
  summary: {
    completedJobsCount: number
    scheduledJobsCount: number
    totalHoursWorked: number
    completedEarnings: number
    scheduledEarnings: number
    totalEarnings: number
    paidAmount: number
    outstandingAmount: number
    currency: string
  }
  lifetime: {
    totalJobsCompleted: number
    totalEarned: number
    totalPaidOut: number
  }
  completedJobs: Job[]
  scheduledJobs: Job[]
  paidJobs: Job[]
  outstandingJobs: Job[]
  recentPayouts: Payout[]
}

const periodPresets = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this-week" },
  { label: "This Month", value: "this-month" },
]

export default function EmployeeFinancesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FinanceData | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState("this-week")
  const [customStartDateTime, setCustomStartDateTime] = useState("")
  const [customEndDateTime, setCustomEndDateTime] = useState("")

  useEffect(() => {
    loadFinances()
  }, [selectedPeriod, customStartDateTime, customEndDateTime])

  useEffect(() => {
    if (selectedPeriod !== "custom") return
    const now = new Date()
    if (!customStartDateTime) {
      setCustomStartDateTime(format(startOfDay(now), "yyyy-MM-dd'T'HH:mm"))
    }
    if (!customEndDateTime) {
      setCustomEndDateTime(format(endOfDay(now), "yyyy-MM-dd'T'HH:mm"))
    }
  }, [selectedPeriod, customStartDateTime, customEndDateTime])

  const getDateRange = () => {
    const now = new Date()
    switch (selectedPeriod) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) }
      case "this-week":
        return { start: startOfWeek(now), end: endOfWeek(now) }
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case "custom":
        return { 
          start: customStartDateTime ? new Date(customStartDateTime) : startOfDay(now),
          end: customEndDateTime ? new Date(customEndDateTime) : endOfDay(now),
        }
      default:
        return { start: startOfWeek(now), end: endOfWeek(now) }
    }
  }

  const loadFinances = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const params = new URLSearchParams({
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      })
      
      const res = await fetch(`/api/employee/finances?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error("Error loading finances:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = "GBP") => {
    const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"
    return `${symbol}${amount.toFixed(2)}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return format(new Date(dateStr), "dd MMM yyyy")
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-"
    return format(new Date(dateStr), "dd MMM, HH:mm")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  const currency = data?.summary.currency || "GBP"
  const sumMinutes = (jobs: Job[] | undefined) =>
    (jobs || []).reduce((sum, job) => {
      const planMinutes = job.planEstimatedDuration ? Number(job.planEstimatedDuration) : NaN
      if (Number.isFinite(planMinutes) && planMinutes > 0) {
        return sum + planMinutes
      }
      return sum + (job.durationMinutes || 0)
    }, 0)
  const completedMinutes = sumMinutes(data?.completedJobs)
  const totalMinutes = sumMinutes(
    Array.from(
      new Map(
        [...(data?.completedJobs || []), ...(data?.scheduledJobs || []), ...(data?.outstandingJobs || [])]
          .map((job) => [job.id, job])
      ).values()
    )
  )
  const completedHours = completedMinutes / 60
  const totalHours = totalMinutes / 60

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">My Finances</h1>
          <p className="text-sm text-muted-foreground">Track your earnings and payments</p>
        </div>
      </div>

      {/* Period Selector */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {periodPresets.map((preset) => (
                <Button
                  key={preset.value}
                  size="sm"
                  variant={selectedPeriod === preset.value ? "default" : "outline"}
                  onClick={() => setSelectedPeriod(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-start" className="text-xs text-muted-foreground">Start</Label>
                <Input
                  id="custom-start"
                  type="datetime-local"
                  value={
                    selectedPeriod === "custom"
                      ? customStartDateTime
                      : format(getDateRange().start, "yyyy-MM-dd'T'HH:mm")
                  }
                  onChange={(e) => {
                    setSelectedPeriod("custom")
                    setCustomStartDateTime(e.target.value)
                  }}
                  className="w-[200px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-end" className="text-xs text-muted-foreground">End</Label>
                <Input
                  id="custom-end"
                  type="datetime-local"
                  value={
                    selectedPeriod === "custom"
                      ? customEndDateTime
                      : format(getDateRange().end, "yyyy-MM-dd'T'HH:mm")
                  }
                  onChange={(e) => {
                    setSelectedPeriod("custom")
                    setCustomEndDateTime(e.target.value)
                  }}
                  className="w-[200px]"
                />
              </div>
            </div>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(data.period.start), "dd MMM yyyy, HH:mm")} - {format(new Date(data.period.end), "dd MMM yyyy, HH:mm")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Total Earnings */}
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-500/20 rounded-full">
                <Wallet className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-xs text-muted-foreground">Period Earnings</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(data?.summary.totalEarnings || 0, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.summary.completedJobsCount || 0} completed + {data?.summary.scheduledJobsCount || 0} scheduled
            </p>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-500/20 rounded-full">
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-xs text-muted-foreground">Outstanding</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(data?.summary.outstandingAmount || 0, currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.outstandingJobs?.length || 0} unpaid jobs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card>
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-lg font-semibold">{completedHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">Completed Hours</p>
            <p className="text-[11px] text-muted-foreground">Total: {totalHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-lg font-semibold">{data?.summary.completedJobsCount || 0}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CreditCard className="h-5 w-5 mx-auto mb-1 text-purple-600" />
            <p className="text-lg font-semibold">{formatCurrency(data?.summary.paidAmount || 0, currency)}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Lifetime Stats */}
      <Card className="mb-4 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Lifetime Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 pt-0">
          <div>
            <p className="text-xl font-bold">{data?.lifetime.totalJobsCompleted || 0}</p>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </div>
          <div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data?.lifetime.totalEarned || 0, currency)}</p>
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </div>
          <div>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(data?.lifetime.totalPaidOut || 0, currency)}</p>
            <p className="text-xs text-muted-foreground">Total Paid</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Jobs and Payments */}
      <Tabs defaultValue="outstanding" className="mb-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="outstanding" className="text-xs">
            Outstanding
            {(data?.outstandingJobs?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                {data?.outstandingJobs?.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding" className="mt-4 space-y-3">
          {data?.outstandingJobs?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No outstanding payments</p>
              </CardContent>
            </Card>
          ) : (
            data?.outstandingJobs?.map(job => (
              <Card key={job.id} className="border-l-4 border-l-orange-500">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.customer}</p>
                    </div>
                    <p className="text-lg font-bold text-orange-600">
                      {formatCurrency(job.earnings, currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDate(job.completedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.durationMinutes} min
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {data?.completedJobs?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No completed jobs</p>
                <p className="text-sm">in this period</p>
              </CardContent>
            </Card>
          ) : (
            data?.completedJobs?.map(job => (
              <Card 
                key={job.id} 
                className={cn(
                  "border-l-4",
                  job.isPaid ? "border-l-green-500" : "border-l-orange-500"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{job.title}</p>
                        {job.isPaid ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{job.customer}</p>
                    </div>
                    <p className={cn(
                      "text-lg font-bold",
                      job.isPaid ? "text-green-600" : "text-foreground"
                    )}>
                      {formatCurrency(job.earnings, currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDate(job.completedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.durationMinutes} min
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-3">
          {data?.recentPayouts?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No payment history</p>
                <p className="text-sm">Your payments will appear here</p>
              </CardContent>
            </Card>
          ) : (
            data?.recentPayouts?.map(payout => (
              <Card key={payout.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">{formatCurrency(parseFloat(payout.amount), payout.currency)}</p>
                      <p className="text-sm text-muted-foreground">
                        {payout.jobCount} job{payout.jobCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Badge variant={payout.status === "paid" ? "default" : "secondary"}>
                      {payout.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatDate(payout.periodStart)} - {formatDate(payout.periodEnd)}
                    </span>
                    {payout.paidAt && (
                      <span>Paid: {formatDate(payout.paidAt)}</span>
                    )}
                  </div>
                  {payout.paymentMethod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      via {payout.paymentMethod}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Upcoming Scheduled Jobs */}
      {(data?.scheduledJobs?.length || 0) > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Upcoming Earnings
            </CardTitle>
            <CardDescription className="text-xs">
              Estimated from {data?.scheduledJobs?.length} scheduled job{data?.scheduledJobs?.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {data?.scheduledJobs?.slice(0, 5).map(job => (
              <div key={job.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(job.scheduledFor)}</p>
                </div>
                <p className="text-sm font-semibold text-blue-600">
                  {formatCurrency(job.earnings, currency)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bottom nav spacer */}
      <div className="h-20" />
    </div>
  )
}
