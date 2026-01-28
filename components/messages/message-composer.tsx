"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

interface MessageComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MessageComposer({ open, onOpenChange }: MessageComposerProps) {
  const [employees, setEmployees] = useState<Array<{ id: number; firstName: string; lastName: string }>>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(["all"])
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    const fetchEmployees = async () => {
      setLoadingEmployees(true)
      try {
        const response = await fetch("/api/employees?status=active")
        if (response.ok) {
          const data = await response.json()
          setEmployees(Array.isArray(data) ? data : [])
          setSelectedRecipients(["all"])
        }
      } finally {
        setLoadingEmployees(false)
      }
    }
    fetchEmployees()
  }, [open])

  const resetForm = () => {
    setSelectedRecipients(["all"])
    setSubject("")
    setMessage("")
  }

  const toggleRecipient = (value: string, checked: boolean) => {
    if (value === "all") {
      setSelectedRecipients(["all"])
      return
    }

    setSelectedRecipients((prev) => {
      const next = new Set(prev.filter((id) => id !== "all"))
      if (checked) {
        next.add(value)
      } else {
        next.delete(value)
      }
      return Array.from(next)
    })
  }

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Select at least one recipient.")
      return
    }
    if (!message.trim()) {
      toast.error("Message body cannot be empty.")
      return
    }

    setSending(true)
    try {
      const sendToAll = selectedRecipients.includes("all")
      const payload = {
        subject: subject.trim() || null,
        body: message.trim(),
        recipientType: sendToAll ? "all" : "employee",
        recipientIds: sendToAll ? null : selectedRecipients,
        messageType: "email",
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error || "Failed to send message")
      }

      toast.success("Message sent")
      onOpenChange(false)
      resetForm()
      window.dispatchEvent(new Event("messages:updated"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send New Message</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Recipients</Label>
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedRecipients.includes("all")}
                  onCheckedChange={(checked) => toggleRecipient("all", Boolean(checked))}
                />
                <span className="text-sm font-medium">All Staff</span>
              </div>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {loadingEmployees ? (
                  <div className="text-sm text-muted-foreground">Loading cleaners...</div>
                ) : (
                  employees.map((employee) => (
                    <label key={employee.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedRecipients.includes(employee.id.toString())}
                        onCheckedChange={(checked) => toggleRecipient(employee.id.toString(), Boolean(checked))}
                        disabled={selectedRecipients.includes("all")}
                      />
                      {employee.firstName} {employee.lastName}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Message subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Write your message..."
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
