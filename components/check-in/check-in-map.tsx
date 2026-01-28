"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Loader2 } from "lucide-react"
import { isToday, parseISO, startOfDay } from "date-fns"

interface WorkSession {
  id: number
  startedAt: string
  endedAt: string | null
}

export function CheckInMap() {
  const [stats, setStats] = useState({ active: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = startOfDay(new Date())
        const startDate = today.toISOString()
        
        const response = await fetch(`/api/work-sessions?startDate=${encodeURIComponent(startDate)}`)
        if (!response.ok) throw new Error("Failed to fetch")
        
        const sessions: WorkSession[] = await response.json()
        
        const todaySessions = sessions.filter(s => isToday(parseISO(s.startedAt)))
        const activeSessions = todaySessions.filter(s => !s.endedAt)
        
        setStats({
          active: activeSessions.length,
          total: todaySessions.length
        })
      } catch (err) {
        console.error("Error fetching check-in stats:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Active Locations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-square rounded-lg bg-muted flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-1/20 to-chart-4/20" />
          <div className="relative space-y-4 text-center p-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Live Tracking</h4>
              <p className="text-sm text-muted-foreground mt-1">Staff locations will appear here in real-time</p>
            </div>
            {loading ? (
              <div className="py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-4 text-sm">
                <div className="p-3 rounded-lg bg-card border">
                  <div className="text-2xl font-bold text-chart-2">{stats.active}</div>
                  <div className="text-muted-foreground">Active</div>
                </div>
                <div className="p-3 rounded-lg bg-card border">
                  <div className="text-2xl font-bold text-chart-4">{stats.total}</div>
                  <div className="text-muted-foreground">Total</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
