import { db, schema } from "@/lib/db"
import { count, desc, eq, sum, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

export type TaskItem = {
  id: number
  client: string
  location?: string | null
  staff?: string | null
  scheduledFor?: Date | string | null
  status?: string | null
}

export type InvoiceItem = {
  id: number
  invoiceNumber: string
  customerName?: string | null
  amount: number
  status: string
  issuedAt?: Date | string | null
  dueAt?: Date | string | null
}

export type CustomerItem = {
  id: number
  name: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  city?: string | null
  status?: string | null
  jobCount: number
  revenue: number
}

const FALLBACK_TASKS: TaskItem[] = [
  {
    id: 1,
    client: "Baker Street Apartments",
    location: "221B Baker St, London",
    staff: "Alice Thompson",
    scheduledFor: new Date(),
    status: "scheduled",
  },
  {
    id: 2,
    client: "Cityview Offices",
    location: "123 High St, Manchester",
    staff: "Unassigned",
    scheduledFor: new Date(),
    status: "pending",
  },
]

const FALLBACK_INVOICES: InvoiceItem[] = [
  {
    id: 1,
    invoiceNumber: "INV-1001",
    customerName: "Baker Street Apartments",
    amount: 1250,
    status: "pending",
    issuedAt: new Date(),
    dueAt: new Date(),
  },
  {
    id: 2,
    invoiceNumber: "INV-1002",
    customerName: "Cityview Offices",
    amount: 980,
    status: "paid",
    issuedAt: new Date(),
    dueAt: new Date(),
  },
]

const FALLBACK_CUSTOMERS: CustomerItem[] = [
  {
    id: 1,
    name: "John Watson",
    firstName: "John",
    lastName: "Watson",
    email: "john.watson@example.com",
    phone: "+44 20 7946 0958",
    city: "London",
    status: "active",
    jobCount: 12,
    revenue: 15340,
  },
  {
    id: 2,
    name: "Sarah Chen",
    firstName: "Sarah",
    lastName: "Chen",
    email: "sarah.chen@example.com",
    phone: "+44 161 123 4567",
    city: "Manchester",
    status: "active",
    jobCount: 9,
    revenue: 11210,
  },
]

export async function getUpcomingJobs(limit = 20): Promise<TaskItem[]> {
  const client = db
  if (!client) return FALLBACK_TASKS.slice(0, limit)

  try {
    // Get session to filter by company
    const session = await getSession()
    if (!session) return FALLBACK_TASKS.slice(0, limit)

    const rows = await client.query.jobs.findMany({
      limit,
      where: eq(schema.jobs.companyId, session.companyId),
      orderBy: [desc(schema.jobs.scheduledFor)],
      with: {
        customer: true,
        assignee: true,
      },
    })

    return rows.map((job) => {
      const customer = job.customer as any
      return {
        id: job.id,
        client: customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : "Unassigned",
        location: job.location ?? job.city ?? "",
        staff: job.assignee ? `${(job.assignee as any).firstName} ${(job.assignee as any).lastName}` : "Unassigned",
        scheduledFor: job.scheduledFor ?? null,
        status: job.status ?? "scheduled",
      }
    })
  } catch (error) {
    console.error("Failed to load jobs", error)
    return FALLBACK_TASKS.slice(0, limit)
  }
}

export async function getRecentInvoices(limit = 10): Promise<InvoiceItem[]> {
  const client = db
  if (!client) return FALLBACK_INVOICES.slice(0, limit)

  try {
    // Get session to filter by company
    const session = await getSession()
    if (!session) return FALLBACK_INVOICES.slice(0, limit)

    const rows = await client.query.invoices.findMany({
      limit,
      where: eq(schema.invoices.companyId, session.companyId),
      orderBy: [desc(schema.invoices.issuedAt)],
      with: {
        customer: true,
      },
    })

    return rows.map((invoice) => {
      const customer = invoice.customer as any
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id}`,
        customerName: customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : "Unknown",
        amount: typeof invoice.total === "string" ? Number(invoice.total) : invoice.total ?? 0,
        status: invoice.status ?? "draft",
        issuedAt: invoice.issuedAt ?? null,
        dueAt: invoice.dueAt ?? null,
      }
    })
  } catch (error) {
    console.error("Failed to load invoices", error)
    return FALLBACK_INVOICES.slice(0, limit)
  }
}

export async function getCustomersWithStats(limit = 50): Promise<CustomerItem[]> {
  const client = db
  if (!client) return FALLBACK_CUSTOMERS.slice(0, limit)

  try {
    // Get session to filter by company
    const session = await getSession()
    if (!session) return FALLBACK_CUSTOMERS.slice(0, limit)

    const rows = await client
      .select({
        id: schema.customers.id,
        firstName: schema.customers.firstName,
        lastName: schema.customers.lastName,
        email: schema.customers.email,
        phone: schema.customers.phone,
        city: schema.customers.city,
        status: schema.customers.status,
        jobCount: count(schema.jobs.id),
        revenue: sum(schema.invoices.total),
      })
      .from(schema.customers)
      .leftJoin(schema.jobs, eq(schema.jobs.customerId, schema.customers.id))
      .leftJoin(schema.invoices, eq(schema.invoices.customerId, schema.customers.id))
      .where(eq(schema.customers.companyId, session.companyId))
      .groupBy(schema.customers.id)
      .orderBy(desc(schema.customers.createdAt))
      .limit(limit)

    return rows.map((row) => ({
      id: row.id,
      name: `${row.firstName} ${row.lastName}`,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      city: row.city,
      status: row.status,
      jobCount: Number(row.jobCount ?? 0),
      revenue:
        typeof row.revenue === "string"
          ? Number(row.revenue)
          : typeof row.revenue === "number"
            ? row.revenue
          : 0,
    }))
  } catch (error) {
    console.error("Failed to load customers", error)
    return FALLBACK_CUSTOMERS.slice(0, limit)
  }
}
