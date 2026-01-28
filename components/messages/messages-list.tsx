"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Reply, Trash2, Loader2 } from "lucide-react"
import { Thumbs } from "@/components/ui/thumbs"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

interface Message {
  id: number
  subject: string
  body: string
  senderType: string
  senderId: number
  recipientType: string
  recipientId: number | null
  readAt?: string | null
  createdAt: string
  sender?: { firstName: string; lastName: string } | null
  customer?: { firstName: string; lastName: string } | null
}

export function MessagesList() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteMessageId, setDeleteMessageId] = useState<number | null>(null)

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 30000)
    const handleRefresh = () => fetchMessages()
    window.addEventListener("messages:updated", handleRefresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener("messages:updated", handleRefresh)
    }
  }, [])

  const fetchMessages = async () => {
    try {
      const response = await fetch("/api/messages?limit=10")
      if (response.ok) {
        const data = await response.json()
        setMessages(data)
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async (id: number) => {
    try {
      await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAsRead: true }),
      })
      setMessages(messages.map(m => m.id === id ? { ...m, readAt: new Date().toISOString() } : m))
    } catch (error) {
      console.error("Failed to mark message as read:", error)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/messages/${id}`, { method: "DELETE" })
      if (response.ok) {
        setMessages(messages.filter(m => m.id !== id))
        toast.success("Message deleted")
      }
    } catch (error) {
      toast.error("Failed to delete message")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No messages yet.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Recent Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
        {messages.map((message) => {
          const isRead = Boolean(message.readAt)
          const senderName = message.sender 
            ? `${message.sender.firstName} ${message.sender.lastName}`
            : message.customer
              ? `${message.customer.firstName} ${message.customer.lastName}`
              : "Unknown"
          const initials = senderName.split(" ").map((n) => n[0]).join("")

          return (
            <div
              key={message.id}
              className={`p-4 border rounded-lg hover:bg-accent/50 transition-colors ${
                !isRead ? "border-primary/50 bg-primary/5" : ""
              }`}
              onClick={() => !isRead && handleMarkRead(message.id)}
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{senderName}</h4>
                        {!isRead && (
                          <Badge variant="default" className="h-5 px-1.5 text-xs">
                            New
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {message.senderType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{message.subject || "No subject"}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{message.body}</p>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Reply className="h-3 w-3 mr-2" />
                        Reply
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteMessageId(message.id)
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete
                      </Button>
                    </div>
                    {/* Thumbs up/down for quick feedback */}
                    <div className="mt-1">
                      <Thumbs />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        </CardContent>
      </Card>
      <AlertDialog open={deleteMessageId !== null} onOpenChange={(open) => !open && setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the message from your list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteMessageId !== null) {
                  handleDelete(deleteMessageId)
                  setDeleteMessageId(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
