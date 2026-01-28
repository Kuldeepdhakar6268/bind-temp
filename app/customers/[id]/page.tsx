"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, MessageSquare, FileText, Star,
  Send, FileSignature, Receipt, CheckCircle, User, Edit
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { JobCornerActions } from "@/components/jobs/job-corner-actions"

type CustomerAddress = {
  id: number
  label: string | null
  address: string
  addressLine2: string | null
  city: string | null
  postcode: string | null
  country: string | null
}

type Customer = {
  id: number; name: string; firstName: string; lastName: string; email: string
  phone: string | null; alternatePhone: string | null; address: string | null
  addressLine2: string | null; city: string | null; postcode: string | null
  country: string | null; customerType: string; status: string
  companyName: string | null; notes: string | null; specialInstructions: string | null
  accessInstructions: string | null; parkingInstructions: string | null
  preferredContactMethod: string | null; source: string | null; createdAt: Date | string
  addresses?: CustomerAddress[]
}

type Job = {
  id: number; title: string; scheduledFor: Date | string | null
  scheduledEnd: Date | string | null; status: string
}

type Invoice = {
  id: number; invoiceNumber: string; total: string; status: string
  dueDate: Date | string | null; issueDate: Date | string
}

export default function CustomerDetailPage() {
  const params = useParams()
  const [newNote, setNewNote] = useState("")
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalSpent: 0, jobsCompleted: 0 })

  const loadCustomerData = useCallback(async () => {
    try {
      const customerId = params.id
      const customerRes = await fetch(`/api/customers/${customerId}`)
      if (!customerRes.ok) throw new Error("Customer not found")
      const customerData = await customerRes.json()
      setCustomer(customerData)

      const jobsRes = await fetch(`/api/jobs?customerId=${customerId}`)
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        const jobsList = Array.isArray(jobsData) ? jobsData : jobsData.jobs || []
        setJobs(jobsList)
        const completed = jobsList.filter((j: Job) => j.status === "completed").length
        setStats(prev => ({ ...prev, jobsCompleted: completed }))
      }

      const invoicesRes = await fetch(`/api/invoices?customerId=${customerId}`)
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json()
        const invoicesList = Array.isArray(invoicesData) ? invoicesData : []
        setInvoices(invoicesList)
        const total = invoicesList.reduce((sum: number, inv: Invoice) => 
          inv.status === "paid" ? sum + parseFloat(inv.total || "0") : sum, 0)
        setStats(prev => ({ ...prev, totalSpent: total }))
      }
    } catch (error) {
      console.error("Error loading customer:", error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) loadCustomerData()
  }, [params.id, loadCustomerData])

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const upcomingJobs = jobs.filter(job => job.status === "scheduled" || job.status === "pending")

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-center">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Customer Not Found</h3>
          <p className="text-muted-foreground mb-4">The customer does not exist.</p>
          <Link href="/customers"><Button>Back to Customers</Button></Link>
        </CardContent></Card>
      </div>
    )
  }

  const fullAddress = [customer.address, customer.city, customer.postcode].filter(Boolean).join(", ")
  const customerSince = customer.createdAt ? format(new Date(customer.createdAt), "MMM d, yyyy") : "Unknown"

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12"><AvatarFallback>{getInitials(customer.name)}</AvatarFallback></Avatar>
            <div>
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <p className="text-muted-foreground">{customer.customerType} Customer since {customerSince}</p>
            </div>
          </div>
        </div>
        <Link href={`/customers/${customer.id}/edit`}><Button variant="outline"><Edit className="h-4 w-4 mr-2" />Edit</Button></Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Receipt className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">£{stats.totalSpent.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total spent</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><CheckCircle className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.jobsCompleted}</p><p className="text-sm text-muted-foreground">Jobs completed</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-yellow-100 rounded-lg"><Star className="h-5 w-5 text-yellow-600" /></div><div><p className="text-2xl font-bold">{jobs.length}</p><p className="text-sm text-muted-foreground">Total jobs</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-100 rounded-lg"><Calendar className="h-5 w-5 text-purple-600" /></div><div><p className="text-2xl font-bold">{upcomingJobs.length}</p><p className="text-sm text-muted-foreground">Upcoming</p></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="jobs" className="space-y-4">
            <TabsList>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="jobs">
              <Card><CardHeader><CardTitle>Jobs</CardTitle></CardHeader>
                <CardContent>
                  {jobs.length === 0 ? <p className="text-center text-muted-foreground py-8">No jobs yet</p> :
                    <div className="space-y-3">{jobs.map(job => (
                      <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{job.title}</p>
                          {job.scheduledFor && (
                            <p className="text-sm text-muted-foreground">{format(new Date(job.scheduledFor), "PPP")}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={job.status === "completed" ? "default" : "outline"}>{job.status}</Badge>
                          <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                            <JobCornerActions
                              jobId={job.id}
                              title={job.title}
                              status={job.status}
                              onRefresh={loadCustomerData}
                              align="end"
                            />
                          </div>
                        </div>
                      </div>
                    ))}</div>}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="invoices">
              <Card><CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
                <CardContent>
                  {invoices.length === 0 ? <p className="text-center text-muted-foreground py-8">No invoices yet</p> :
                    <div className="space-y-3">{invoices.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div><p className="font-medium font-mono">{inv.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(inv.issueDate), "PPP")}</p>
                        </div>
                        <div className="text-right"><p className="font-medium">£{parseFloat(inv.total).toFixed(2)}</p>
                          <Badge variant={inv.status === "paid" ? "default" : "outline"}>{inv.status}</Badge>
                        </div>
                      </div>
                    ))}</div>}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="notes">
              <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <Textarea placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} className="mb-3" />
                    <div className="flex justify-end"><Button size="sm"><Send className="h-4 w-4 mr-1" />Add Note</Button></div>
                  </div>
                  {customer.notes && <div className="p-4 border rounded-lg"><h4 className="font-medium mb-2">Notes</h4><p className="text-sm text-muted-foreground">{customer.notes}</p></div>}
                  {customer.specialInstructions && <div className="p-4 border rounded-lg"><h4 className="font-medium mb-2">Special Instructions</h4><p className="text-sm text-muted-foreground">{customer.specialInstructions}</p></div>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{customer.email}</p></div></div>
              {customer.phone && <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{customer.phone}</p></div></div>}
              {fullAddress && <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-sm text-muted-foreground">Primary Address</p><p className="font-medium">{fullAddress}</p></div></div>}
            </CardContent>
          </Card>

          {customer.addresses && customer.addresses.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base">Additional Addresses</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {customer.addresses.map((addr) => {
                  const addrLine = [addr.address, addr.addressLine2, addr.city, addr.postcode, addr.country].filter(Boolean).join(", ")
                  return (
                    <div key={addr.id} className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        {addr.label && <p className="text-sm font-medium text-muted-foreground">{addr.label}</p>}
                        <p className="font-medium">{addrLine}</p>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <Card><CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/jobs/new?customerId=${customer.id}`} className="block"><Button variant="outline" className="w-full justify-start"><Calendar className="h-4 w-4 mr-2" />Schedule Job</Button></Link>
              <Link href={`/invoices/new?customerId=${customer.id}`} className="block"><Button variant="outline" className="w-full justify-start"><Receipt className="h-4 w-4 mr-2" />Create Invoice</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
