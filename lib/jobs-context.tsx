"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

// Job types
export interface Job {
  id: number
  title: string
  description?: string | null
  customerId: number
  assignedTo?: number | null
  location?: string | null
  city?: string | null
  postcode?: string | null
  scheduledFor?: string | null
  scheduledEnd?: string | null
  durationMinutes?: number | null
  status: string
  priority?: string | null
  estimatedPrice?: string | null
  actualPrice?: string | null
  currency?: string | null
  recurrence?: string | null
  qualityRating?: string | null
  customerFeedback?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt?: string | null
  customer?: {
    id: number
    firstName: string
    lastName: string
    email: string
    phone?: string | null
  }
  assignee?: {
    id: number
    firstName: string
    lastName: string
    email?: string | null
  } | null
}

export interface JobFilters {
  status?: string
  employeeId?: number
  customerId?: number
  startDate?: string
  endDate?: string
  search?: string
}

export interface JobStats {
  total: number
  scheduled: number
  inProgress: number
  completed: number
  cancelled: number
}

// Notification types for jobs
export type JobNotificationType =
  | "job_created"
  | "job_assigned"
  | "job_started"
  | "job_completed"
  | "job_cancelled"
  | "job_rescheduled"
  | "job_reminder"

export interface JobNotification {
  id: string
  type: JobNotificationType
  jobId: number
  title: string
  message: string
  timestamp: Date
  read: boolean
}

// Context type
interface JobsContextType {
  // State
  jobs: Job[]
  loading: boolean
  error: string | null
  filters: JobFilters
  stats: JobStats
  selectedJob: Job | null
  notifications: JobNotification[]
  unreadCount: number
  lastRefresh: Date | null

  // Actions
  fetchJobs: (filters?: JobFilters) => Promise<void>
  refreshJobs: () => Promise<void>
  setFilters: (filters: JobFilters) => void
  selectJob: (job: Job | null) => void
  
  // Job CRUD
  createJob: (job: Partial<Job>) => Promise<Job | null>
  updateJob: (id: number, updates: Partial<Job>) => Promise<Job | null>
  deleteJob: (id: number) => Promise<boolean>
  
  // Job Actions
  startJob: (id: number, data?: { latitude?: number; longitude?: number; notes?: string }) => Promise<boolean>
  completeJob: (id: number, data?: { actualPrice?: number; notes?: string }) => Promise<boolean>
  cancelJob: (id: number, reason: string) => Promise<boolean>
  rescheduleJob: (id: number, newDate: string, reason?: string) => Promise<boolean>
  assignJob: (id: number, employeeId: number, sendNotification?: boolean) => Promise<boolean>
  duplicateJob: (id: number) => Promise<Job | null>
  
  // Notifications
  sendConfirmation: (id: number) => Promise<boolean>
  sendReminder: (id: number, options?: { toCustomer?: boolean; toEmployee?: boolean }) => Promise<boolean>
  markNotificationRead: (notificationId: string) => void
  clearNotifications: () => void

  // Subscriptions
  subscribe: (callback: (jobs: Job[]) => void) => () => void
}

const JobsContext = createContext<JobsContextType | undefined>(undefined)

// Notification config
const JOB_NOTIFICATION_CONFIG: Record<JobNotificationType, { icon: string; color: string }> = {
  job_created: { icon: "📝", color: "blue" },
  job_assigned: { icon: "👤", color: "purple" },
  job_started: { icon: "▶️", color: "amber" },
  job_completed: { icon: "✅", color: "green" },
  job_cancelled: { icon: "❌", color: "red" },
  job_rescheduled: { icon: "📅", color: "orange" },
  job_reminder: { icon: "🔔", color: "cyan" },
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<JobFilters>({})
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [notifications, setNotifications] = useState<JobNotification[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  
  const subscribers = useRef<Set<(jobs: Job[]) => void>>(new Set())
  const refreshInterval = useRef<NodeJS.Timeout | null>(null)

  // Calculate stats
  const stats: JobStats = {
    total: jobs.length,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    inProgress: jobs.filter((j) => j.status === "in-progress").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  // Notify subscribers
  const notifySubscribers = useCallback((updatedJobs: Job[]) => {
    subscribers.current.forEach((callback) => callback(updatedJobs))
  }, [])

  // Add notification
  const addNotification = useCallback((type: JobNotificationType, jobId: number, title: string, message: string) => {
    const notification: JobNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      jobId,
      title,
      message,
      timestamp: new Date(),
      read: false,
    }
    setNotifications((prev) => [notification, ...prev].slice(0, 50)) // Keep last 50

    // Show toast
    const config = JOB_NOTIFICATION_CONFIG[type]
    toast.info(`${config.icon} ${title}`, { description: message })
  }, [])

  // Fetch jobs
  const fetchJobs = useCallback(async (newFilters?: JobFilters) => {
    const activeFilters = newFilters || filters
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (activeFilters.status && activeFilters.status !== "all") {
        params.append("status", activeFilters.status)
      }
      if (activeFilters.employeeId) {
        params.append("employeeId", activeFilters.employeeId.toString())
      }
      if (activeFilters.customerId) {
        params.append("customerId", activeFilters.customerId.toString())
      }
      if (activeFilters.startDate) {
        params.append("startDate", activeFilters.startDate)
      }
      if (activeFilters.endDate) {
        params.append("endDate", activeFilters.endDate)
      }

      const response = await fetch(`/api/jobs?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch jobs")

      const data = await response.json()
      setJobs(data)
      setLastRefresh(new Date())
      notifySubscribers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [filters, notifySubscribers])

  // Refresh jobs
  const refreshJobs = useCallback(async () => {
    await fetchJobs(filters)
  }, [fetchJobs, filters])

  // Set filters
  const setFilters = useCallback((newFilters: JobFilters) => {
    setFiltersState(newFilters)
  }, [])

  // Select job
  const selectJob = useCallback((job: Job | null) => {
    setSelectedJob(job)
  }, [])

  // Create job
  const createJob = useCallback(async (jobData: Partial<Job>): Promise<Job | null> => {
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create job")
      }

      const newJob = await response.json()
      setJobs((prev) => [newJob, ...prev])
      notifySubscribers([newJob, ...jobs])
      addNotification("job_created", newJob.id, "Job Created", `"${newJob.title}" has been created`)
      return newJob
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create job")
      return null
    }
  }, [jobs, notifySubscribers, addNotification])

  // Update job
  const updateJob = useCallback(async (id: number, updates: Partial<Job>): Promise<Job | null> => {
    try {
      const response = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update job")
      }

      const updatedJob = await response.json()
      setJobs((prev) => prev.map((j) => (j.id === id ? updatedJob : j)))
      notifySubscribers(jobs.map((j) => (j.id === id ? updatedJob : j)))
      return updatedJob
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update job")
      return null
    }
  }, [jobs, notifySubscribers])

  // Delete job
  const deleteJob = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete job")

      setJobs((prev) => prev.filter((j) => j.id !== id))
      notifySubscribers(jobs.filter((j) => j.id !== id))
      toast.success("Job deleted")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete job")
      return false
    }
  }, [jobs, notifySubscribers])

  // Start job
  const startJob = useCallback(async (id: number, data?: { latitude?: number; longitude?: number; notes?: string }): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to start job")
      }

      const result = await response.json()
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "in-progress" } : j)))
      notifySubscribers(jobs.map((j) => (j.id === id ? { ...j, status: "in-progress" } : j)))
      addNotification("job_started", id, "Job Started", `Job has been started`)
      toast.success("Job started!")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start job")
      return false
    }
  }, [jobs, notifySubscribers, addNotification])

  // Complete job
  const completeJob = useCallback(async (id: number, data?: { actualPrice?: number; notes?: string }): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to complete job")
      }

      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "completed", completedAt: new Date().toISOString() } : j)))
      notifySubscribers(jobs.map((j) => (j.id === id ? { ...j, status: "completed" } : j)))
      addNotification("job_completed", id, "Job Completed", `Job has been marked as completed`)
      toast.success("Job completed!")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete job")
      return false
    }
  }, [jobs, notifySubscribers, addNotification])

  // Cancel job
  const cancelJob = useCallback(async (id: number, reason: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to cancel job")
      }

      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "cancelled" } : j)))
      notifySubscribers(jobs.map((j) => (j.id === id ? { ...j, status: "cancelled" } : j)))
      addNotification("job_cancelled", id, "Job Cancelled", reason)
      toast.success("Job cancelled")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel job")
      return false
    }
  }, [jobs, notifySubscribers, addNotification])

  // Reschedule job
  const rescheduleJob = useCallback(async (id: number, newDate: string, reason?: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newDate, reason }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to reschedule job")
      }

      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, scheduledFor: newDate } : j)))
      notifySubscribers(jobs.map((j) => (j.id === id ? { ...j, scheduledFor: newDate } : j)))
      addNotification("job_rescheduled", id, "Job Rescheduled", `Job has been rescheduled`)
      toast.success("Job rescheduled")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reschedule job")
      return false
    }
  }, [jobs, notifySubscribers, addNotification])

  // Assign job
  const assignJob = useCallback(async (id: number, employeeId: number, sendNotification = true): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, sendNotification }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to assign job")
      }

      const result = await response.json()
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, assignedTo: employeeId, assignee: result.job?.assignee } : j)))
      notifySubscribers(jobs.map((j) => (j.id === id ? { ...j, assignedTo: employeeId } : j)))
      addNotification("job_assigned", id, "Job Assigned", `Job has been assigned`)
      toast.success("Job assigned!")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign job")
      return false
    }
  }, [jobs, notifySubscribers, addNotification])

  // Duplicate job
  const duplicateJob = useCallback(async (id: number): Promise<Job | null> => {
    try {
      const response = await fetch(`/api/jobs/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to duplicate job")
      }

      const result = await response.json()
      const newJob = result.job
      setJobs((prev) => [newJob, ...prev])
      notifySubscribers([newJob, ...jobs])
      addNotification("job_created", newJob.id, "Job Duplicated", `"${newJob.title}" has been created`)
      toast.success("Job duplicated!")
      return newJob
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate job")
      return null
    }
  }, [jobs, notifySubscribers, addNotification])

  // Send confirmation
  const sendConfirmation = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}/send-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to send confirmation")
      }

      toast.success("Confirmation email sent!")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send confirmation")
      return false
    }
  }, [])

  // Send reminder
  const sendReminder = useCallback(async (id: number, options?: { toCustomer?: boolean; toEmployee?: boolean }): Promise<boolean> => {
    try {
      const response = await fetch(`/api/jobs/${id}/send-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendToCustomer: options?.toCustomer ?? true,
          sendToEmployee: options?.toEmployee ?? true,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "Failed to send reminder")
      }

      addNotification("job_reminder", id, "Reminder Sent", "Job reminder has been sent")
      toast.success("Reminder sent!")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder")
      return false
    }
  }, [addNotification])

  // Mark notification read
  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    )
  }, [])

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Subscribe to job updates
  const subscribe = useCallback((callback: (jobs: Job[]) => void) => {
    subscribers.current.add(callback)
    return () => {
      subscribers.current.delete(callback)
    }
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshInterval.current = setInterval(() => {
      fetchJobs(filters)
    }, 30000)

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current)
      }
    }
  }, [fetchJobs, filters])

  // Initial fetch
  useEffect(() => {
    fetchJobs()
  }, [])

  const value: JobsContextType = {
    jobs,
    loading,
    error,
    filters,
    stats,
    selectedJob,
    notifications,
    unreadCount,
    lastRefresh,
    fetchJobs,
    refreshJobs,
    setFilters,
    selectJob,
    createJob,
    updateJob,
    deleteJob,
    startJob,
    completeJob,
    cancelJob,
    rescheduleJob,
    assignJob,
    duplicateJob,
    sendConfirmation,
    sendReminder,
    markNotificationRead,
    clearNotifications,
    subscribe,
  }

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}

export function useJobs() {
  const context = useContext(JobsContext)
  if (context === undefined) {
    throw new Error("useJobs must be used within a JobsProvider")
  }
  return context
}

// Hook for subscribing to job updates
export function useJobSubscription(callback: (jobs: Job[]) => void) {
  const { subscribe } = useJobs()
  
  useEffect(() => {
    const unsubscribe = subscribe(callback)
    return unsubscribe
  }, [subscribe, callback])
}

// Hook for getting a single job
export function useJob(jobId: number) {
  const { jobs, loading, error } = useJobs()
  const job = jobs.find((j) => j.id === jobId) || null
  return { job, loading, error }
}
