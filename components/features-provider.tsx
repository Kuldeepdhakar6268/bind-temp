"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { 
  EnabledFeature, 
  isFeatureEnabled, 
  isRouteAccessible,
  filterSidebarItems,
  filterNavigationSections,
} from "@/lib/features"

interface FeaturesContextType {
  features: EnabledFeature[]
  loading: boolean
  isEnabled: (featureSlug: string) => boolean
  canAccessRoute: (route: string) => boolean
  filterItems: <T extends { title: string }>(items: T[]) => T[]
  filterSections: <T extends { title: string; items: Array<{ title: string }> }>(sections: T[]) => T[]
  refresh: () => Promise<void>
}

const FeaturesContext = createContext<FeaturesContextType | null>(null)

export function useFeaturesContext() {
  const context = useContext(FeaturesContext)
  if (!context) {
    throw new Error("useFeaturesContext must be used within a FeaturesProvider")
  }
  return context
}

// Safe hook that doesn't throw if context is missing
export function useFeatures() {
  const context = useContext(FeaturesContext)
  
  // Return default values if no context
  if (!context) {
    return {
      features: [],
      loading: true,
      isEnabled: () => true, // Default to enabled when no context
      canAccessRoute: () => true,
      filterItems: <T extends { title: string }>(items: T[]) => items,
      filterSections: <T extends { title: string; items: Array<{ title: string }> }>(sections: T[]) => sections,
      refresh: async () => {},
    }
  }
  
  return context
}

interface FeaturesProviderProps {
  children: React.ReactNode
  apiEndpoint?: string // '/api/features' for company, '/api/employee/features' for employees
}

export function FeaturesProvider({ 
  children, 
  apiEndpoint = "/api/features" 
}: FeaturesProviderProps) {
  const [features, setFeatures] = useState<EnabledFeature[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch(apiEndpoint)
      if (res.ok) {
        const data = await res.json()
        const loadedFeatures = data.features || []
        console.log('[FeaturesProvider] Loaded features:', loadedFeatures.map((f: EnabledFeature) => f.slug))
        setFeatures(loadedFeatures)
      } else if (res.status === 401) {
        // User not authenticated - this is expected on public pages, don't log as error
        console.log('[FeaturesProvider] User not authenticated, using default features')
        setFeatures([])
      } else {
        console.error('[FeaturesProvider] Failed to fetch features:', res.status)
      }
    } catch (error) {
      console.error("[FeaturesProvider] Failed to fetch features:", error)
    } finally {
      setLoading(false)
    }
  }, [apiEndpoint])

  useEffect(() => {
    fetchFeatures()
  }, [fetchFeatures])

  const isEnabled = useCallback(
    (featureSlug: string) => isFeatureEnabled(features, featureSlug),
    [features]
  )

  const canAccessRoute = useCallback(
    (route: string) => isRouteAccessible(features, route),
    [features]
  )

  const filterItems = useCallback(
    <T extends { title: string }>(items: T[]) => filterSidebarItems(items, features),
    [features]
  )

  const filterSections = useCallback(
    <T extends { title: string; items: Array<{ title: string }> }>(sections: T[]) =>
      filterNavigationSections(sections, features),
    [features]
  )

  const value: FeaturesContextType = {
    features,
    loading,
    isEnabled,
    canAccessRoute,
    filterItems,
    filterSections,
    refresh: fetchFeatures,
  }

  return (
    <FeaturesContext.Provider value={value}>
      {children}
    </FeaturesContext.Provider>
  )
}
