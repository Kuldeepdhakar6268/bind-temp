import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorAlertProps {
  error: string | null | undefined
  title?: string
  className?: string
  variant?: "default" | "destructive"
}

export function ErrorAlert({ error, title = "Error", className, variant = "destructive" }: ErrorAlertProps) {
  if (!error) return null

  return (
    <Alert variant={variant} className={cn("mb-4", className)}>
      <XCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-sm">{error}</AlertDescription>
    </Alert>
  )
}

interface WarningAlertProps {
  message: string | null | undefined
  title?: string
  className?: string
}

export function WarningAlert({ message, title = "Warning", className }: WarningAlertProps) {
  if (!message) return null

  return (
    <Alert className={cn("mb-4 border-amber-500/50 bg-amber-500/10", className)}>
      <AlertCircle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">{title}</AlertTitle>
      <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
        {message}
      </AlertDescription>
    </Alert>
  )
}

