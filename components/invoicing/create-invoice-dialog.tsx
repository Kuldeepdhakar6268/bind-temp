"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"

interface CreateInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface InvoiceItem {
  id: number
  title: string
  description: string
  quantity: string
  unitPrice: string
  amount: string
  taxable: boolean
}

interface Customer {
  id: number
  name: string
  email: string
}

export function CreateInvoiceDialog({ open, onOpenChange, onSuccess }: CreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [taxRate, setTaxRate] = useState("20")
  const [discountAmount, setDiscountAmount] = useState("0")
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("Payment is due within 30 days of the invoice date.")
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 1, title: "", description: "", quantity: "1", unitPrice: "0", amount: "0", taxable: true }
  ])
  const todayValue = new Date().toISOString().split("T")[0]

  // Load customers
  useEffect(() => {
    if (open) {
      fetch("/api/customers")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCustomers(data.map((c: any) => ({
              id: c.id,
              name: c.name || `${c.firstName} ${c.lastName}`,
              email: c.email
            })))
          }
        })
        .catch((err) => console.error("Failed to load customers:", err))
    }
  }, [open])

  const addItem = () => {
    setItems([...items, {
      id: items.length + 1,
      title: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      amount: "0",
      taxable: true
    }])
  }

  const removeItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = (id: number, field: keyof InvoiceItem, value: any) => {
    setItems(items.map((item) => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        // Recalculate amount if quantity or unitPrice changed
        if (field === "quantity" || field === "unitPrice") {
          const qty = parseFloat(field === "quantity" ? value : updated.quantity) || 0
          const price = parseFloat(field === "unitPrice" ? value : updated.unitPrice) || 0
          updated.amount = (qty * price).toFixed(2)
        }
        return updated
      }
      return item
    }))
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0)
    const taxableAmount = items
      .filter((item) => item.taxable)
      .reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0)
    const tax = (taxableAmount * parseFloat(taxRate || "0")) / 100
    const discount = parseFloat(discountAmount || "0")
    const total = subtotal + tax - discount
    return { subtotal, tax, discount, total }
  }

  const handleSubmit = async (status: "draft" | "sent") => {
    if (!customerId) {
      setError("Please select a customer")
      return
    }

    if (items.length === 0 || items.every((item) => !item.title)) {
      setError("Please add at least one line item")
      return
    }

    if (dueDate) {
      const selected = new Date(dueDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selected < today) {
        setError("Due date cannot be in the past")
        return
      }
    }

    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          items: items.filter((item) => item.title),
          taxRate,
          discountAmount,
          notes,
          terms,
          dueAt: dueDate || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invoice")
      }

      // If status is "sent", update the invoice status
      if (status === "sent") {
        await fetch(`/api/invoices/${data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "sent", issuedAt: new Date().toISOString() }),
        })
      }

      // Reset form
      setCustomerId("")
      setDueDate("")
      setTaxRate("20")
      setDiscountAmount("0")
      setNotes("")
      setTerms("Payment is due within 30 days of the invoice date.")
      setItems([{ id: 1, title: "", description: "", quantity: "1", unitPrice: "0", amount: "0", taxable: true }])

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md sm:max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                min={todayValue}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="discount">Discount Amount (GBP)</Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="space-y-2 p-3 border rounded-lg">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-6">
                      <Input
                        placeholder="Item title *"
                        value={item.title}
                        onChange={(e) => updateItem(item.id, "title", e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        type="number"
                        placeholder="Price"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2 flex items-center justify-between">
                      <span className="text-sm font-medium">GBP {item.amount}</span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    placeholder="Description (optional)"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">GBP {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax ({taxRate}%):</span>
              <span className="font-medium">GBP {totals.tax.toFixed(2)}</span>
            </div>
            {parseFloat(discountAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span>Discount:</span>
                <span className="font-medium">-GBP {totals.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>GBP {totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="terms">Payment Terms</Label>
            <Textarea
              id="terms"
              placeholder="Payment terms..."
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit("draft")}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Save as Draft
          </Button>
          <Button onClick={() => handleSubmit("sent")} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Creating..." : "Create & Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
