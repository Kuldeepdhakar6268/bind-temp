"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BellRing, CheckCircle2 } from "lucide-react"
import {
  CompanyNotificationSettings,
  defaultCompanyNotificationSettings,
} from "@/lib/notification-settings"

const notificationOptions: Array<{
  key: keyof CompanyNotificationSettings
  title: string
  description: string
}> = [
  {
    key: "jobUpdates",
    title: "Job Updates",
    description: "Created, completed, or important job status changes.",
  },
  {
    key: "employeeUpdates",
    title: "Employee Updates",
    description: "Check-in/out events and job acceptance or decline.",
  },
  {
    key: "bookingUpdates",
    title: "Booking Updates",
    description: "New booking requests, changes, or cancellations.",
  },
  {
    key: "quoteUpdates",
    title: "Quote Updates",
    description: "Quote acceptance or rejection alerts.",
  },
  {
    key: "financeUpdates",
    title: "Finance Updates",
    description: "Payment and invoice-related alerts.",
  },
]

export function NotificationSettings() {
  const [settings, setSettings] = useState<CompanyNotificationSettings>(
    defaultCompanyNotificationSettings
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allEnabled = notificationOptions.every((opt) => settings[opt.key])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/company/notifications")
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load notification settings")
      }
      setSettings(data.settings || defaultCompanyNotificationSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notification settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const handleToggleAll = (checked: boolean) => {
    const next = { ...settings }
    notificationOptions.forEach((opt) => {
      next[opt.key] = checked
    })
    setSettings(next)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch("/api/company/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save notification settings")
      }
      setSettings(data.settings || settings)
      setMessage("Notification preferences saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notification settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-4 w-1/2 bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
          <div className="h-4 w-1/3 bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose which email notifications you want to receive. You can disable noisy events and keep only what matters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(message || error) && (
            <Alert variant={error ? "destructive" : "default"}>
              <AlertDescription className="flex items-center gap-2">
                {!error && <CheckCircle2 className="h-4 w-4" />}
                {error || message}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">All notifications</Label>
              <p className="text-xs text-muted-foreground">
                Toggle everything on or off, then customize individual categories below.
              </p>
            </div>
            <Switch checked={allEnabled} onCheckedChange={handleToggleAll} />
          </div>

          <div className="space-y-4">
            {notificationOptions.map((option) => (
              <div
                key={option.key}
                className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3"
              >
                <div className="space-y-1">
                  <Label className="text-sm font-medium">{option.title}</Label>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                <Switch
                  checked={settings[option.key]}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, [option.key]: checked }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
            <Button variant="outline" onClick={loadSettings} disabled={saving}>
              Reset to saved
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
