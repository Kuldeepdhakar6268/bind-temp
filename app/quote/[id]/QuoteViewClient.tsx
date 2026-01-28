"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle, XCircle, Clock, FileText, AlertCircle, Building2, Mail, Phone } from "lucide-react"
import { toast } from "sonner"

interface QuoteItem {
  id: number
  title: string
  description?: string | null
  quantity: string | null
  unitPrice: string | null
  amount: string | null
}

interface Quote {
  id: number
  quoteNumber: string
  title: string
  description?: string | null
  items: QuoteItem[]
  subtotal: string | null
  taxRate?: string | null
  taxAmount?: string | null
  discountAmount?: string | null
  total: string | null
  currency?: string | null
  status: string
  validUntil?: Date | null
  notes?: string | null
  terms?: string | null
  createdAt: Date
  customer?: {
    name?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

interface Company {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  postcode?: string | null
  logo?: string | null
}

interface QuoteViewClientProps {
  quote: Quote
  company: Company | null | undefined
  action?: string
}

export default function QuoteViewClient({ quote, company, action }: QuoteViewClientProps) {
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [currentStatus, setCurrentStatus] = useState(quote.status)

  const currency = quote.currency || "GBP"
  const currencySymbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"
  
  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date()
  const canRespond = currentStatus === "sent" && !isExpired

  // Auto-show accept confirmation if action=accept
  useEffect(() => {
    if (action === "accept" && canRespond) {
      handleAccept()
    }
  }, [action])

  const handleAccept = async () => {
    if (!canRespond) return
    
    setIsAccepting(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to accept quote")
      }

      setCurrentStatus("accepted")
      toast.success("Quote accepted successfully!", {
        description: "The service provider has been notified.",
      })
    } catch (error: any) {
      toast.error(error.message || "Failed to accept quote")
    } finally {
      setIsAccepting(false)
    }
  }

  const handleReject = async () => {
    if (!canRespond) return
    
    setIsRejecting(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to reject quote")
      }

      setCurrentStatus("rejected")
      setShowRejectDialog(false)
      toast.info("Quote declined", {
        description: "The service provider has been notified.",
      })
    } catch (error: any) {
      toast.error(error.message || "Failed to reject quote")
    } finally {
      setIsRejecting(false)
    }
  }

  const getStatusBadge = () => {
    switch (currentStatus) {
      case "accepted":
        return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Accepted</Badge>
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Declined</Badge>
      case "sent":
        return isExpired 
          ? <Badge variant="outline" className="text-red-600 border-red-200"><AlertCircle className="h-3 w-3 mr-1" /> Expired</Badge>
          : <Badge variant="outline" className="text-orange-600 border-orange-200"><Clock className="h-3 w-3 mr-1" /> Awaiting Response</Badge>
      case "draft":
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" /> Draft</Badge>
      case "converted":
        return <Badge className="bg-blue-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Converted to Job</Badge>
      default:
        return <Badge variant="secondary">{currentStatus}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                {company?.logo ? (
                  <img src={company.logo} alt={company.name} className="h-12 mb-2" />
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900">{company?.name || "Service Provider"}</h1>
                )}
                {company?.address && (
                  <p className="text-sm text-gray-500">
                    {company.address}{company.city && `, ${company.city}`}{company.postcode && ` ${company.postcode}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">QUOTE</p>
                <p className="text-xl font-bold text-gray-900">{quote.quoteNumber}</p>
                {getStatusBadge()}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Quote Details */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Quote For</h3>
                <p className="font-semibold text-gray-900">{quote.customer?.name || "Customer"}</p>
                {quote.customer?.email && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {quote.customer.email}
                  </p>
                )}
                {quote.customer?.phone && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {quote.customer.phone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Quote Date</h3>
                <p className="text-gray-900">
                  {new Date(quote.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                {quote.validUntil && (
                  <>
                    <h3 className="text-sm font-medium text-gray-500 mt-3 mb-1">Valid Until</h3>
                    <p className={isExpired ? "text-red-600 font-medium" : "text-gray-900"}>
                      {new Date(quote.validUntil).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {isExpired && " (Expired)"}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{quote.title}</h2>
              {quote.description && (
                <p className="text-gray-600">{quote.description}</p>
              )}
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden mb-6">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Description</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Unit Price</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500">{item.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.quantity || 1}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {currencySymbol}{parseFloat(item.unitPrice || "0").toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {currencySymbol}{parseFloat(item.amount || "0").toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-gray-500">Subtotal</td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      {currencySymbol}{parseFloat(quote.subtotal || "0").toFixed(2)}
                    </td>
                  </tr>
                  {quote.taxAmount && parseFloat(quote.taxAmount) > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right text-gray-500">
                        Tax ({quote.taxRate || 0}%)
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {currencySymbol}{parseFloat(quote.taxAmount).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {quote.discountAmount && parseFloat(quote.discountAmount) > 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right text-green-600">Discount</td>
                      <td className="px-4 py-2 text-right text-green-600">
                        -{currencySymbol}{parseFloat(quote.discountAmount).toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right text-xl font-bold text-gray-900">
                      {currencySymbol}{parseFloat(quote.total || "0").toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes & Terms */}
            {quote.notes && (
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-1">Notes</h4>
                <p className="text-blue-800 text-sm whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            {quote.terms && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-1">Terms & Conditions</h4>
                <p className="text-gray-600 text-sm whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {canRespond && (
          <Card>
            <CardContent className="py-6">
              <p className="text-center text-gray-600 mb-4">
                Would you like to proceed with this quote?
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isAccepting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline Quote
                </Button>
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleAccept}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    "Processing..."
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Quote
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Messages */}
        {currentStatus === "accepted" && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-900 mb-1">Quote Accepted!</h3>
              <p className="text-green-700">
                Thank you for accepting this quote. {company?.name || "The service provider"} will be in touch shortly to schedule the work.
              </p>
            </CardContent>
          </Card>
        )}

        {currentStatus === "rejected" && (
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="py-6 text-center">
              <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700 mb-1">Quote Declined</h3>
              <p className="text-gray-600">
                This quote has been declined. If you change your mind, please contact {company?.name || "the service provider"} directly.
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && currentStatus === "sent" && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="py-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-red-900 mb-1">Quote Expired</h3>
              <p className="text-red-700">
                This quote is no longer valid. Please contact {company?.name || "the service provider"} for an updated quote.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Questions about this quote?</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            {company?.email && (
              <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                <Mail className="h-4 w-4" /> {company.email}
              </a>
            )}
            {company?.phone && (
              <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                <Phone className="h-4 w-4" /> {company.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Quote</DialogTitle>
            <DialogDescription>
              Please let us know why you're declining this quote (optional). This helps us improve our services.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for declining (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isRejecting}>
              {isRejecting ? "Processing..." : "Decline Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
