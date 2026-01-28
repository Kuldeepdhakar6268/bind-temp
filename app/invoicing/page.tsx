export const dynamic = "force-dynamic"

import { InvoicingPageShell } from "@/components/invoicing/invoicing-page-shell"
import { getRecentInvoices } from "@/lib/db/queries"

export default async function InvoicingPage() {
  // Fetch all invoices (no limit) for accurate stats calculation
  const invoices = await getRecentInvoices(1000)
  return <InvoicingPageShell invoices={invoices} />
}
