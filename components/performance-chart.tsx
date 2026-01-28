"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

const data = [
  { month: "Jan", completed: 420, scheduled: 480 },
  { month: "Feb", completed: 380, scheduled: 420 },
  { month: "Mar", completed: 510, scheduled: 540 },
  { month: "Apr", completed: 490, scheduled: 520 },
  { month: "May", completed: 560, scheduled: 590 },
  { month: "Jun", completed: 620, scheduled: 650 },
]

export function PerformanceChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar dataKey="completed" fill="hsl(var(--chart-2))" name="Completed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="scheduled" fill="hsl(var(--chart-1))" name="Scheduled" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
