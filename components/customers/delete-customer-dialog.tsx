"use client"

import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

interface Customer {
  id: number
  firstName: string
  lastName: string
  email: string
  status: string
}

interface DeleteCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSuccess?: () => void
}

export function DeleteCustomerDialog({ open, onOpenChange, customer, onSuccess }: DeleteCustomerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleStatusChange = async () => {
    if (!customer) return

    setError("")
    setLoading(true)

    const isInactive = customer.status === "inactive"
    const nextStatus = isInactive ? "active" : "inactive"

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update customer status")
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (!customer) return null

  const isInactive = customer.status === "inactive"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isInactive ? "Reactivate Customer" : "Deactivate Customer"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isInactive ? (
              <>
                Reactivate{" "}
                <span className="font-semibold">
                  {customer.firstName} {customer.lastName}
                </span>{" "}
                ({customer.email})?
                <br />
                <br />
                This will restore their account and allow new bookings. The customer will receive an email notification.
              </>
            ) : (
              <>
                Deactivate{" "}
                <span className="font-semibold">
                  {customer.firstName} {customer.lastName}
                </span>{" "}
                ({customer.email})?
                <br />
                <br />
                This will set the customer to inactive. All historical data stays safe and can be reactivated at any time.
                The customer will receive an email notification.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleStatusChange}
            disabled={loading}
            className={isInactive ? "" : "bg-destructive hover:bg-destructive/90"}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isInactive ? "Reactivating..." : "Deactivating..."}
              </>
            ) : (
              isInactive ? "Reactivate Customer" : "Deactivate Customer"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

