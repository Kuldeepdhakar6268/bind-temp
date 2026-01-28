import { Session } from "./auth"

export type UserRole = "admin" | "manager" | "employee"

export const ROLES = {
  ADMIN: "admin" as UserRole,
  MANAGER: "manager" as UserRole,
  EMPLOYEE: "employee" as UserRole,
}

// Check if user has admin or manager role
export function isAdminOrManager(session: Session | null): boolean {
  if (!session) return false
  return session.role === ROLES.ADMIN || session.role === ROLES.MANAGER
}

// Check if user is an employee
export function isEmployee(session: Session | null): boolean {
  if (!session) return false
  return session.role === ROLES.EMPLOYEE
}

// Check if user has admin role
export function isAdmin(session: Session | null): boolean {
  if (!session) return false
  return session.role === ROLES.ADMIN
}

// Routes accessible by employees
export const EMPLOYEE_ROUTES = [
  "/employee",
  "/employee/jobs",
  "/employee/schedule",
  "/employee/profile",
]

// Routes accessible only by admin/manager
export const ADMIN_ROUTES = [
  "/",
  "/customers",
  "/jobs",
  "/invoices",
  "/payments",
  "/employees",
  "/reports",
  "/settings",
]

// Check if a route is accessible by the user's role
export function canAccessRoute(session: Session | null, pathname: string): boolean {
  if (!session) return false

  // Admins and managers can access everything
  if (isAdminOrManager(session)) {
    return true
  }

  // Employees can only access employee routes
  if (isEmployee(session)) {
    return EMPLOYEE_ROUTES.some(route => pathname.startsWith(route))
  }

  return false
}

// Get default route based on user role
export function getDefaultRoute(session: Session | null): string {
  if (!session) return "/login"
  
  if (isAdminOrManager(session)) {
    return "/"
  }
  
  if (isEmployee(session)) {
    return "/employee"
  }
  
  return "/"
}

