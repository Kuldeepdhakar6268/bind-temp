"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { isValidUKPhone, formatUKPhone, getUKPhoneErrorMessage } from "@/lib/phone-validation"
import { Phone } from "lucide-react"

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string
  error?: string
  onValueChange?: (value: string, isValid: boolean) => void
  showValidation?: boolean
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, label, error, onValueChange, showValidation = true, ...props }, ref) => {
    const [internalError, setInternalError] = React.useState<string>("")
    const [touched, setTouched] = React.useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      
      // Clear error when user starts typing
      if (internalError) setInternalError("")
      
      // Call parent onChange if provided
      onValueChange?.(value, isValidUKPhone(value))
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true)
      const value = e.target.value
      
      if (value && showValidation) {
        if (!isValidUKPhone(value)) {
          setInternalError(getUKPhoneErrorMessage(value))
        } else {
          // Auto-format on blur
          const formatted = formatUKPhone(value)
          e.target.value = formatted
          onValueChange?.(formatted, true)
        }
      }
      
      // Call parent onBlur if provided
      props.onBlur?.(e)
    }

    const displayError = error || (touched && internalError)

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={props.id} className={cn(displayError && "text-destructive")}>
            {label}
          </Label>
        )}
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={ref}
            type="tel"
            placeholder="07xxx xxxxxx or 01xxx xxxxxx"
            className={cn(
              "pl-10",
              displayError && "border-destructive focus-visible:ring-destructive",
              className
            )}
            onChange={handleChange}
            onBlur={handleBlur}
            {...props}
          />
        </div>
        {displayError && (
          <p className="text-sm text-destructive">{displayError}</p>
        )}
        {!displayError && !touched && (
          <p className="text-xs text-muted-foreground">
            UK mobile (07xxx xxxxxx) or landline (01xxx xxxxxx)
          </p>
        )}
      </div>
    )
  }
)

PhoneInput.displayName = "PhoneInput"

