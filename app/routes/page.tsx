"use client"

import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Clock, Navigation, Users, Fuel, TrendingDown, Download } from "lucide-react"
import { useState } from "react"

const routeData = [
  {
    id: 1,
    date: "2024-01-15",
    staff: "Sarah Chen",
    jobs: [
      { time: "8:00 AM", client: "Elite Towers", address: "123 Main St", duration: "2h", status: "completed" },
      { time: "10:30 AM", client: "City Hall", address: "456 Oak Ave", duration: "1.5h", status: "completed" },
      { time: "1:00 PM", client: "Tech Campus", address: "789 Park Blvd", duration: "3h", status: "in-progress" },
      { time: "4:30 PM", client: "Grand Hotel", address: "321 Beach Rd", duration: "2h", status: "scheduled" },
    ],
    totalDistance: "28.5 miles",
    estimatedFuel: "$12.40",
    optimizedSaving: "35%",
  },
  {
    id: 2,
    date: "2024-01-15",
    staff: "Mike Johnson",
    jobs: [
      { time: "8:30 AM", client: "Shopping Mall", address: "555 Commerce Dr", duration: "2.5h", status: "completed" },
      { time: "11:30 AM", client: "Office Plaza", address: "888 Business Way", duration: "2h", status: "in-progress" },
      { time: "2:00 PM", client: "Retail Center", address: "999 Market St", duration: "1.5h", status: "scheduled" },
    ],
    totalDistance: "22.3 miles",
    estimatedFuel: "$9.70",
    optimizedSaving: "28%",
  },
]

export default function RoutesPage() {
  const [selectedDate, setSelectedDate] = useState("2024-01-15")

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Route Optimizer</h1>
            <p className="text-muted-foreground mt-1">Optimize travel routes and reduce costs</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Select Date
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Routes
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Navigation className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Distance</p>
                <p className="text-2xl font-bold">50.8 miles</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">vs 78.2 miles unoptimized</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Fuel className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fuel Cost</p>
                <p className="text-2xl font-bold">$22.10</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Saved $12.50 today</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Optimization</p>
                <p className="text-2xl font-bold">32%</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Average savings</p>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Visual Route Map</h3>
          <div className="relative bg-muted rounded-lg h-[400px] overflow-hidden">
            <img src="/google-maps-style-route-visualization-with-multipl.jpg" alt="Route Map" className="w-full h-full object-cover" />
            <div className="absolute top-4 right-4 bg-background/95 backdrop-blur p-3 rounded-lg shadow-lg">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span>Scheduled</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Interactive map showing optimized routes for all staff members with live GPS tracking
          </p>
        </Card>

        <div className="space-y-4">
          {routeData.map((route) => (
            <Card key={route.id} className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{route.staff}</h3>
                    <p className="text-sm text-muted-foreground">{route.jobs.length} jobs scheduled</p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{route.totalDistance}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-muted-foreground" />
                    <span>{route.estimatedFuel}</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700">
                    {route.optimizedSaving} saved
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                {route.jobs.map((job, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          job.status === "completed"
                            ? "bg-green-500 text-white"
                            : job.status === "in-progress"
                              ? "bg-blue-500 text-white"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>
                      {index < route.jobs.length - 1 && <div className="w-0.5 h-8 bg-border"></div>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{job.client}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.address}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{job.time}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{job.duration}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline">
                  <MapPin className="h-4 w-4 mr-2" />
                  View in Maps
                </Button>
                <Button size="sm" variant="outline">
                  <Navigation className="h-4 w-4 mr-2" />
                  Send to Staff
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
