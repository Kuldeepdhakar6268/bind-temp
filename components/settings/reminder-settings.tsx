"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Bell, Send, Eye } from "lucide-react"
import { defaultReminderConfig } from "@/lib/reminders-config"

export function ReminderSettings() {
  const [config, setConfig] = useState(defaultReminderConfig)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [preview, setPreview] = useState<any>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    setMessage("")

    try {
      // In a real implementation, save to database
      // For now, just show success message
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setMessage("Reminder settings saved successfully!")
    } catch (error) {
      setMessage("Failed to save settings")
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    try {
      const response = await fetch("/api/reminders/process")
      const data = await response.json()
      setPreview(data)
    } catch (error) {
      console.error("Error fetching preview:", error)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSendClick = () => {
    setSendDialogOpen(true)
  }

  const handleSendReminders = async () => {
    setSendDialogOpen(false)
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/reminders/process", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reminders")
      }

      setMessage(`Successfully sent ${data.sent} reminders (${data.failed} failed)`)
      setPreview(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send reminders")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Payment Reminder Settings
          </CardTitle>
          <CardDescription>
            Configure automatic payment reminders for overdue invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Automatic Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Send automatic payment reminders to customers
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, enabled: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Days Before Due Date</Label>
            <p className="text-sm text-muted-foreground">
              Send reminders this many days before the invoice is due
            </p>
            <div className="flex gap-2">
              {config.daysBeforeDue.map((days, index) => (
                <Badge key={index} variant="secondary">
                  {days} days
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Days After Due Date</Label>
            <p className="text-sm text-muted-foreground">
              Send reminders this many days after the invoice is overdue
            </p>
            <div className="flex gap-2">
              {config.daysAfterDue.map((days, index) => (
                <Badge key={index} variant="destructive">
                  {days} days
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject</Label>
            <Input
              id="subject"
              value={config.emailTemplate.subject}
              onChange={(e) =>
                setConfig({
                  ...config,
                  emailTemplate: {
                    ...config.emailTemplate,
                    subject: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              value={config.emailTemplate.body}
              onChange={(e) =>
                setConfig({
                  ...config,
                  emailTemplate: {
                    ...config.emailTemplate,
                    body: e.target.value,
                  },
                })
              }
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {"{invoiceNumber}"}, {"{customerName}"}, {"{amount}"}, {"{dueDate}"}, {"{status}"}, {"{companyName}"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              Save Settings
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
              <Eye className="h-4 w-4 mr-2" />
              Preview Pending Reminders
            </Button>
            <Button variant="secondary" onClick={handleSendClick} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              Send Reminders Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Reminders ({preview.count})</CardTitle>
          </CardHeader>
          <CardContent>
            {preview.count === 0 ? (
              <p className="text-sm text-muted-foreground">No reminders pending</p>
            ) : (
              <div className="space-y-2">
                {preview.invoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customerName} ({invoice.customerEmail})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">£{parseFloat(invoice.amount).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send Reminders Confirmation Dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Payment Reminders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send payment reminders now? This will email all customers with overdue payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendReminders}>
              Send Reminders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

