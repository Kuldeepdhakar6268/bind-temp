"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Loader2, MapPin } from "lucide-react"

export type AddressSuggestion = {
  id: string
  label: string
  address: string
  addressLine2?: string
  city?: string
  postcode?: string
  country?: string
}

interface AddressAutocompleteProps {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: AddressSuggestion) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function AddressAutocomplete({
  id,
  name,
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  required,
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/geoapify/autocomplete?text=${encodeURIComponent(value.trim())}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          setSuggestions([])
          setOpen(false)
          return
        }

        const data = await response.json()
        const nextSuggestions = Array.isArray(data?.results) ? data.results : []
        setSuggestions(nextSuggestions)
        setOpen(nextSuggestions.length > 0)
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") {
          setSuggestions([])
          setOpen(false)
        }
      } finally {
        setLoading(false)
      }
    }, 350)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [value])

  const handleSelect = (suggestion: AddressSuggestion) => {
    onSelect(suggestion)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) {
            setOpen(true)
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md">
          <ul className="max-h-64 overflow-y-auto py-1 text-sm">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-muted"
                  onClick={() => handleSelect(suggestion)}
                >
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span className={cn("text-foreground", suggestion.label ? "line-clamp-2" : "")}>
                    {suggestion.label || suggestion.address}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
