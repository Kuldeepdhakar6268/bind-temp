"use client"

import { useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  Search,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Navigation,
  Package,
  History,
  KeyRound as Pound,
  Edit,
  XCircle,
  Users,
} from "lucide-react"

const equipment = [
  {
    id: "EQ-001",
    name: "Vacuum Cleaner - Henry HVR200",
    category: "Vacuum",
    status: "operational",
    assignedTo: "Sarah Johnson",
    purchaseDate: "Jan 15, 2023",
    lastService: "Nov 10, 2024",
    nextService: "Feb 10, 2025",
    condition: 85,
    value: 180,
    location: "Central London",
  },
  {
    id: "EQ-002",
    name: "Commercial Steam Cleaner",
    category: "Steam",
    status: "operational",
    assignedTo: "Michael Chen",
    purchaseDate: "Mar 20, 2023",
    lastService: "Dec 5, 2024",
    nextService: "Mar 5, 2025",
    condition: 92,
    value: 450,
    location: "North London",
  },
  {
    id: "EQ-003",
    name: "Carpet Cleaner - Bissell Big Green",
    category: "Carpet",
    status: "maintenance",
    assignedTo: "Unassigned",
    purchaseDate: "Jun 1, 2022",
    lastService: "Oct 15, 2024",
    nextService: "Overdue",
    condition: 45,
    value: 380,
    location: "Workshop",
  },
  {
    id: "EQ-004",
    name: "Window Cleaning Kit",
    category: "Windows",
    status: "operational",
    assignedTo: "Emma Williams",
    purchaseDate: "Aug 10, 2024",
    lastService: "N/A",
    nextService: "Aug 10, 2025",
    condition: 100,
    value: 120,
    location: "South London",
  },
  {
    id: "EQ-005",
    name: "Floor Buffer Machine",
    category: "Floor",
    status: "repair",
    assignedTo: "James Brown",
    purchaseDate: "Feb 28, 2022",
    lastService: "Sep 20, 2024",
    nextService: "Pending repair",
    condition: 30,
    value: 650,
    location: "Repair Shop",
  },
  {
    id: "EQ-006",
    name: "Pressure Washer",
    category: "Exterior",
    status: "operational",
    assignedTo: "David Wilson",
    purchaseDate: "Apr 5, 2023",
    lastService: "Nov 25, 2024",
    nextService: "Feb 25, 2025",
    condition: 78,
    value: 320,
    location: "East London",
  },
]

const maintenanceHistory = [
  {
    id: 1,
    equipment: "EQ-001",
    name: "Vacuum Cleaner - Henry HVR200",
    type: "Routine Service",
    date: "Nov 10, 2024",
    cost: 45,
    technician: "ABC Repairs",
    notes: "Filter replaced, motor checked",
  },
  {
    id: 2,
    equipment: "EQ-005",
    name: "Floor Buffer Machine",
    type: "Repair",
    date: "Sep 20, 2024",
    cost: 180,
    technician: "Floor Care Services",
    notes: "Motor issue - parts ordered",
  },
  {
    id: 3,
    equipment: "EQ-002",
    name: "Commercial Steam Cleaner",
    type: "Routine Service",
    date: "Dec 5, 2024",
    cost: 65,
    technician: "ABC Repairs",
    notes: "Descaled, hoses inspected",
  },
  {
    id: 4,
    equipment: "EQ-003",
    name: "Carpet Cleaner - Bissell Big Green",
    type: "Routine Service",
    date: "Oct 15, 2024",
    cost: 55,
    technician: "Bissell Service Centre",
    notes: "Brushes worn - needs replacement",
  },
]

const upcomingMaintenance = equipment
  .filter((e) => e.status === "maintenance" || e.nextService === "Overdue")
  .concat(equipment.filter((e) => e.condition < 50))

function getStatusBadge(status: string) {
  switch (status) {
    case "operational":
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" /> Operational
        </Badge>
      )
    case "maintenance":
      return (
        <Badge className="bg-orange-500">
          <Wrench className="h-3 w-3 mr-1" /> Maintenance
        </Badge>
      )
    case "repair":
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" /> Repair
        </Badge>
      )
    case "retired":
      return (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" /> Retired
        </Badge>
      )
    default:
      return null
  }
}

function getConditionColor(condition: number) {
  if (condition >= 80) return "bg-green-500"
  if (condition >= 50) return "bg-yellow-500"
  return "bg-red-500"
}

export default function EquipmentPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const totalValue = equipment.reduce((sum, e) => sum + e.value, 0)
  const operationalCount = equipment.filter((e) => e.status === "operational").length
  const maintenanceCost = maintenanceHistory.reduce((sum, m) => sum + m.cost, 0)

  const filteredEquipment = equipment.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />
      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Equipment Tracking</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage equipment inventory and maintenance schedules</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Equipment</DialogTitle>
              <DialogDescription>Register new equipment in the inventory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Equipment Name</Label>
                <Input placeholder="e.g., Vacuum Cleaner - Henry HVR200" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacuum">Vacuum</SelectItem>
                      <SelectItem value="steam">Steam Cleaner</SelectItem>
                      <SelectItem value="carpet">Carpet Cleaner</SelectItem>
                      <SelectItem value="floor">Floor Care</SelectItem>
                      <SelectItem value="windows">Window Cleaning</SelectItem>
                      <SelectItem value="exterior">Exterior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Value (GBP)</Label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sarah">Sarah Johnson</SelectItem>
                      <SelectItem value="michael">Michael Chen</SelectItem>
                      <SelectItem value="emma">Emma Williams</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Service Interval</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Every 3 months</SelectItem>
                    <SelectItem value="6">Every 6 months</SelectItem>
                    <SelectItem value="12">Every 12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setCreateDialogOpen(false)}>Add Equipment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{equipment.length}</p>
                <p className="text-sm text-muted-foreground">Total equipment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{operationalCount}</p>
                <p className="text-sm text-muted-foreground">Operational</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Pound className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">GBP {totalValue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Wrench className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">GBP {maintenanceCost}</p>
                <p className="text-sm text-muted-foreground">Maintenance YTD</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {upcomingMaintenance.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Maintenance Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMaintenance.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.nextService === "Overdue" ? "Service overdue" : `Condition: ${item.condition}%`}
                    </p>
                  </div>
                  <Button size="sm">Schedule Service</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 md:w-fit md:inline-flex">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
          <TabsTrigger value="schedule">Service Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Equipment Inventory</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search equipment..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-0">
              <div className="space-y-3 sm:hidden">
                {maintenanceHistory.map((record) => (
                  <div key={record.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{record.name}</p>
                        <p className="text-xs text-muted-foreground">{record.date} - {record.equipment}</p>
                      </div>
                      <Badge variant={record.type === "Repair" ? "destructive" : "outline"}>
                        {record.type}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Technician:</span> {record.technician}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Notes:</span> {record.notes}
                    </div>
                    <div className="mt-2 text-sm font-semibold">GBP {record.cost}</div>
                  </div>
                ))}
              </div>

              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Next Service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipment.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.id}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell>{item.assignedTo}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={item.condition}
                            className={`w-16 h-2 ${getConditionColor(item.condition)}`}
                          />
                          <span className="text-sm">{item.condition}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={item.nextService === "Overdue" ? "text-red-600 font-medium" : ""}>
                          {item.nextService}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance History</CardTitle>
              <CardDescription>Record of all maintenance and repairs</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-0">
              <div className="space-y-3 sm:hidden">
                {filteredEquipment.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.id} - {item.category}</p>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {item.assignedTo}
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {item.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {item.nextService}
                      </div>
                      <div className="flex items-center gap-1">
                        <Pound className="h-3 w-3" />
                        GBP {item.value.toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={item.condition} className={`flex-1 h-2 ${getConditionColor(item.condition)}`} />
                      <span className="text-xs text-muted-foreground">{item.condition}%</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <History className="h-3 w-3 mr-1" />
                        History
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{record.equipment}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.type === "Repair" ? "destructive" : "outline"}>{record.type}</Badge>
                      </TableCell>
                      <TableCell>{record.technician}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{record.notes}</TableCell>
                      <TableCell className="text-right font-medium">GBP {record.cost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {equipment
                  .filter((e) => e.status === "operational")
                  .map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-lg">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">Last: {item.lastService}</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="text-left sm:text-right">
                          <p className="font-medium">{item.nextService}</p>
                          <p className="text-sm text-muted-foreground">Next service due</p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          <Calendar className="h-4 w-4 mr-1" />
                          Schedule
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </main>
    </div>
  )
}
