"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Banknote,
  RefreshCcw,
  Mail,
  Phone,
  Calendar,
} from "lucide-react"

const payments = [
  {
    id: "INV-001",
    customer: "Tech Solutions Ltd",
    email: "accounts@techsolutions.com",
    amount: 2450.0,
    dueDate: "2024-01-20",
    status: "overdue",
    daysPastDue: 5,
    lastReminder: "2024-01-22",
  },
  {
    id: "INV-002",
    customer: "Green Gardens Hotel",
    email: "finance@greengardens.com",
    amount: 1875.5,
    dueDate: "2024-01-25",
    status: "pending",
    daysPastDue: 0,
    lastReminder: null,
  },
  {
    id: "INV-003",
    customer: "City Medical Center",
    email: "billing@citymedical.com",
    amount: 3200.0,
    dueDate: "2024-01-18",
    status: "overdue",
    daysPastDue: 7,
    lastReminder: "2024-01-23",
  },
  {
    id: "INV-004",
    customer: "Riverside Apartments",
    email: "management@riverside.com",
    amount: 950.0,
    dueDate: "2024-01-28",
    status: "pending",
    daysPastDue: 0,
    lastReminder: null,
  },
  {
    id: "INV-005",
    customer: "Premier Law Firm",
    email: "accounts@premierlaw.com",
    amount: 1650.0,
    dueDate: "2024-01-15",
    status: "paid",
    paidDate: "2024-01-14",
    lastReminder: null,
  },
  {
    id: "INV-006",
    customer: "Central Library",
    email: "admin@centrallibrary.org",
    amount: 780.0,
    dueDate: "2024-01-22",
    status: "paid",
    paidDate: "2024-01-20",
    lastReminder: null,
  },
]

const recurringBilling = [
  {
    id: 1,
    customer: "Tech Solutions Ltd",
    service: "Weekly Office Cleaning",
    amount: 450.0,
    frequency: "Weekly",
    nextBilling: "2024-01-29",
    status: "active",
  },
  {
    id: 2,
    customer: "Green Gardens Hotel",
    service: "Daily Common Area Cleaning",
    amount: 1200.0,
    frequency: "Monthly",
    nextBilling: "2024-02-01",
    status: "active",
  },
  {
    id: 3,
    customer: "City Medical Center",
    service: "Medical Grade Sanitization",
    amount: 2800.0,
    frequency: "Monthly",
    nextBilling: "2024-02-01",
    status: "active",
  },
  {
    id: 4,
    customer: "Riverside Apartments",
    service: "Bi-weekly Hallway Cleaning",
    amount: 350.0,
    frequency: "Bi-weekly",
    nextBilling: "2024-02-05",
    status: "paused",
  },
]

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isReminderOpen, setIsReminderOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<(typeof payments)[0] | null>(null)

  const totalOverdue = payments.filter((p) => p.status === "overdue").reduce((sum, p) => sum + p.amount, 0)
  const totalPending = payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0)
  const totalCollected = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0)
  const collectionRate = (totalCollected / (totalCollected + totalOverdue + totalPending)) * 100

  const filteredPayments = payments.filter(
    (payment) =>
      payment.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.id.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Management</h1>
          <p className="text-muted-foreground">Track invoices, reminders, and recurring billing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button>
            <Send className="mr-2 h-4 w-4" />
            Send Bulk Reminders
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">£{totalOverdue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === "overdue").length} invoices overdue
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalPending.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === "pending").length} awaiting payment
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Collected This Month</CardTitle>
            <Banknote className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">£{totalCollected.toFixed(2)}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">12%</span> from last month
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{collectionRate.toFixed(1)}%</div>
            <Progress value={collectionRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="outstanding">
        <TabsList>
          <TabsTrigger value="outstanding">Outstanding Invoices</TabsTrigger>
          <TabsTrigger value="recurring">Recurring Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Invoice Tracking</CardTitle>
                  <CardDescription>Monitor and follow up on outstanding payments</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          payment.status === "overdue"
                            ? "bg-destructive/10 text-destructive"
                            : payment.status === "pending"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-emerald-500/10 text-emerald-500"
                        }`}
                      >
                        {payment.status === "overdue" ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : payment.status === "pending" ? (
                          <Clock className="h-5 w-5" />
                        ) : (
                          <CheckCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{payment.customer}</p>
                          <Badge variant="outline" className="text-xs">
                            {payment.id}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{payment.email}</span>
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          <span>Due: {new Date(payment.dueDate).toLocaleDateString()}</span>
                          {payment.daysPastDue > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-destructive">{payment.daysPastDue} days overdue</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold">£{payment.amount.toFixed(2)}</p>
                        <Badge
                          variant={
                            payment.status === "paid"
                              ? "default"
                              : payment.status === "overdue"
                                ? "destructive"
                                : "secondary"
                          }
                          className={payment.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : ""}
                        >
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </Badge>
                      </div>
                      {payment.status !== "paid" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment)
                              setIsReminderOpen(true)
                            }}
                          >
                            <Send className="mr-1 h-3 w-3" />
                            Remind
                          </Button>
                        </div>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Invoice</DropdownMenuItem>
                          <DropdownMenuItem>Send Reminder</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
                          <DropdownMenuItem>Call Customer</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Write Off</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Recurring Billing</CardTitle>
                  <CardDescription>Manage subscription and recurring payment schedules</CardDescription>
                </div>
                <Button>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Add Recurring Billing
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recurringBilling.map((billing) => (
                  <div
                    key={billing.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <RefreshCcw className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{billing.customer}</p>
                          <Badge variant="outline" className="text-xs">
                            {billing.frequency}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{billing.service}</span>
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          <span>Next: {new Date(billing.nextBilling).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold">£{billing.amount.toFixed(2)}</p>
                        <Badge
                          variant={billing.status === "active" ? "default" : "secondary"}
                          className={billing.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}
                        >
                          {billing.status.charAt(0).toUpperCase() + billing.status.slice(1)}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit Schedule</DropdownMenuItem>
                          <DropdownMenuItem>View History</DropdownMenuItem>
                          <DropdownMenuItem>Generate Invoice Now</DropdownMenuItem>
                          <DropdownMenuItem>
                            {billing.status === "active" ? "Pause" : "Resume"} Billing
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Cancel</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Send Reminder Dialog */}
      <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Payment Reminder</DialogTitle>
            <DialogDescription>
              Send a reminder to {selectedPayment?.customer} for invoice {selectedPayment?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Due:</span>
                <span className="font-semibold">£{selectedPayment?.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date:</span>
                <span>{selectedPayment && new Date(selectedPayment.dueDate).toLocaleDateString()}</span>
              </div>
              {selectedPayment?.daysPastDue && selectedPayment.daysPastDue > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days Overdue:</span>
                  <span className="text-destructive">{selectedPayment.daysPastDue} days</span>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Reminder Method</Label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-transparent">
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
                <Button variant="outline" className="flex-1 bg-transparent">
                  <Phone className="mr-2 h-4 w-4" />
                  SMS
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Custom Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to the reminder..."
                defaultValue={`Dear ${selectedPayment?.customer},\n\nThis is a friendly reminder that payment for invoice ${selectedPayment?.id} is now due. Please arrange payment at your earliest convenience.\n\nThank you for your business.`}
                rows={5}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="include-link" className="rounded border-input" defaultChecked />
              <Label htmlFor="include-link" className="text-sm font-normal">
                Include one-click payment link
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReminderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsReminderOpen(false)}>
              <Send className="mr-2 h-4 w-4" />
              Send Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
