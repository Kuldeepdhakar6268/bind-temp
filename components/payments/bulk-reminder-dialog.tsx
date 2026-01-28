"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Send, Mail, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type BulkReminderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceCount: number
  totalAmount: number
  onSend: (message: string, includeLink: boolean) => Promise<void>
}

export function BulkReminderDialog({
  open,
  onOpenChange,
  invoiceCount,
  totalAmount,
  onSend,
}: BulkReminderDialogProps) {
  const [message, setMessage] = useState(
    `Dear Customer,\n\nThis is a friendly reminder that you have outstanding invoices that require payment. Please review and arrange payment at your earliest convenience.\n\nThank you for your business.`
  )
  const [includeLink, setIncludeLink] = useState(true)
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend(message, includeLink)
      onOpenChange(false)
    } catch (error) {
      console.error("Error sending reminders:", error)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Send Bulk Payment Reminders</DialogTitle>
          <DialogDescription>
            Send payment reminders to multiple customers at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">Invoices to remind:</span>
              <Badge variant="secondary">{invoiceCount}</Badge>
            </div>
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">Total outstanding:</span>
              <span className="font-semibold">GBP {totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-100">
              <p className="font-medium">Important</p>
              <p className="text-xs mt-1">
                This will send email reminders to {invoiceCount} customer{invoiceCount !== 1 ? "s" : ""}. 
                Make sure your message is appropriate for all recipients.
              </p>
            </div>
          </div>

          {/* Reminder Method */}
          <div className="space-y-2">
            <Label>Reminder Method</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled>
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              SMS reminders coming soon
            </p>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="bulk-message">Message Template</Label>
            <Textarea
              id="bulk-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Enter your reminder message..."
            />
            <p className="text-xs text-muted-foreground">
              Invoice details will be automatically included in each email
            </p>
          </div>

          {/* Options */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="include-link"
              checked={includeLink}
              onCheckedChange={(checked) => setIncludeLink(checked as boolean)}
            />
            <Label
              htmlFor="include-link"
              className="text-sm font-normal cursor-pointer"
            >
              Include payment link in emails
            </Label>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()} className="w-full sm:w-auto">
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : `Send ${invoiceCount} Reminder${invoiceCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

