/**
 * Feature access utilities
 * Maps feature slugs to routes and provides access control
 */

// Feature slug to route mapping
export const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  // Company features
  'dashboard': ['/', '/overview'],
  'jobs': ['/scheduling', '/job', '/job-board', '/completed-jobs'],
  'customers': ['/customers'],
  'scheduling-basic': ['/scheduling'],
  'scheduling-advanced': ['/scheduling', '/routes'],
  'invoicing': ['/invoicing'],
  'payments': ['/payments'],
  'quotes': ['/quotes'],
  'contracts': ['/contracts'],
  'cleaning-plans': ['/cleaning-plans'],
  'photo-verification': ['/photo-verification', '/verification-center'],
  'equipment': ['/equipment'],
  'supplies': ['/supply-requests', '/storage'],
  'expenses': ['/expenses'],
  'profitability': ['/profitability'],
  'service-areas': ['/service-areas'],
  'booking-requests': ['/booking-requests'],
  'customer-portal': ['/portal'],
  'messages': ['/messages'],
  'subscriptions': ['/subscriptions'],
  'teams': ['/teams'],
  
  // Employee features
  'employee-profiles': ['/employee/profile'],
  'time-tracking': ['/employee/time', '/work-hours'],
  'job-board': ['/employee/jobs', '/employee/job-board'],
  'mobile-checkin': ['/check-in', '/employee/check-in'],
  'shifts': ['/shifts', '/employee/shifts'],
  'shift-swap': ['/employee/shift-swap'],
  'time-off': ['/time-off', '/employee/time-off'],
  'payroll': ['/work-hours', '/employee/wages'],
  'employee-messaging': ['/employee/messages'],
  'performance': ['/feedback', '/employee/performance'],
}

// Route to feature slug mapping (reverse lookup)
export const ROUTE_FEATURE_MAP: Record<string, string> = {}

// Build reverse mapping
Object.entries(FEATURE_ROUTE_MAP).forEach(([slug, routes]) => {
  routes.forEach(route => {
    ROUTE_FEATURE_MAP[route] = slug
  })
})

// Sidebar item to feature slug mapping
export const SIDEBAR_FEATURE_MAP: Record<string, string> = {
  // Company sidebar items
  'Overview': 'dashboard',
  'Scheduling': 'scheduling-basic',
  'Verification Center': 'photo-verification',
  'Route Optimizer': 'scheduling-advanced',
  'Check-in': 'mobile-checkin',
  'Customers': 'customers',
  'Booking Requests': 'booking-requests',
  'Quotes': 'quotes',
  'Contracts': 'contracts',
  'Customer Feedback': 'performance',
  'Employees': 'employee-profiles',
  'Teams': 'teams',
  'Shift Management': 'shifts',
  'Time-off Requests': 'time-off',
  'Supply Requests': 'supplies',
  'Work Hours': 'time-tracking',
  'Send Message': 'messages',
  'Invoicing': 'invoicing',
  'Payments': 'payments',
  'Expenses': 'expenses',
  'Profitability': 'profitability',
  'Service Areas': 'service-areas',
  'Cleaning Plans': 'cleaning-plans',
  'Equipment': 'equipment',
  'Storage': 'supplies',
  
  // Employee sidebar items
  'Dashboard': 'job-board', // Employee dashboard
  'Job Board': 'job-board',
  'Shifts': 'shifts',
  'Time Off': 'time-off',
  'My Supplies': 'supplies',
  'My Wages': 'payroll',
  'My Finances': 'payroll',
  'Performance': 'performance',
  'Profile': 'employee-profiles',
}

// Core features that are always available
export const CORE_FEATURES = [
  'dashboard',
  'jobs',
  'customers',
  'scheduling-basic',
  'employee-profiles',
  'time-tracking',
  'job-board',
  'teams',
]

export interface EnabledFeature {
  id: number
  slug: string
  name: string
  type: 'company' | 'employee'
}

/**
 * Check if a route requires a specific feature
 */
export function getRequiredFeature(route: string): string | null {
  // Normalize the route
  const normalizedRoute = route.split('?')[0] // Remove query params
  
  // Direct match
  if (ROUTE_FEATURE_MAP[normalizedRoute]) {
    return ROUTE_FEATURE_MAP[normalizedRoute]
  }
  
  // Check if route starts with any mapped route
  for (const [mappedRoute, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (normalizedRoute.startsWith(mappedRoute + '/')) {
      return feature
    }
  }
  
  return null
}

/**
 * Check if a feature is enabled for the company
 * Returns true if:
 * - Feature is a core feature (always enabled)
 * - Feature is in the enabled features list
 * - Feature slug is not mapped (unknown features default to enabled)
 */
export function isFeatureEnabled(
  enabledFeatures: EnabledFeature[],
  featureSlug: string
): boolean {
  // Core features are always enabled
  if (CORE_FEATURES.includes(featureSlug)) {
    return true
  }
  
  // If no features loaded yet, default to showing everything
  if (enabledFeatures.length === 0) {
    return true
  }
  
  return enabledFeatures.some(f => f.slug === featureSlug)
}

/**
 * Check if a route is accessible based on enabled features
 */
export function isRouteAccessible(
  enabledFeatures: EnabledFeature[],
  route: string
): boolean {
  const requiredFeature = getRequiredFeature(route)
  
  // If no feature required, route is accessible
  if (!requiredFeature) {
    return true
  }
  
  return isFeatureEnabled(enabledFeatures, requiredFeature)
}

/**
 * Filter sidebar items based on enabled features
 * Items without a feature mapping are always shown
 * Items with a mapping are shown if:
 * - The feature is a core feature
 * - The feature is in the enabled features list
 * - No features have been loaded yet (loading state)
 */
export function filterSidebarItems<T extends { title: string }>(
  items: T[],
  enabledFeatures: EnabledFeature[]
): T[] {
  const enabledSlugs = enabledFeatures.map(f => f.slug)
  
  return items.filter(item => {
    const requiredFeature = SIDEBAR_FEATURE_MAP[item.title]
    
    // If no feature mapping exists, always show the item
    if (!requiredFeature) {
      console.log(`[filterSidebarItems] "${item.title}" - no mapping, showing`)
      return true
    }
    
    const enabled = isFeatureEnabled(enabledFeatures, requiredFeature)
    console.log(`[filterSidebarItems] "${item.title}" requires "${requiredFeature}" - enabled: ${enabled}, available slugs: ${enabledSlugs.slice(0, 5).join(', ')}...`)
    return enabled
  })
}

/**
 * Filter navigation sections based on enabled features
 */
export function filterNavigationSections<T extends { title: string; items: Array<{ title: string }> }>(
  sections: T[],
  enabledFeatures: EnabledFeature[]
): T[] {
  return sections
    .map(section => ({
      ...section,
      items: filterSidebarItems(section.items, enabledFeatures),
    }))
    .filter(section => section.items.length > 0) as T[]
}
