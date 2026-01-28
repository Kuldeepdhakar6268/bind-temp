"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ClipboardList, Plus, MoreVertical, Edit, Trash, Eye, GripVertical, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Task {
  id?: string
  name: string
  description?: string
  estimatedMinutes?: number
  order: number
}

interface CleaningPlan {
  id: string
  name: string
  description: string | null
  price: string | null
  estimatedDuration: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  tasks: Task[]
}

export function CleaningPlansList() {
  const [plans, setPlans] = useState<CleaningPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<CleaningPlan | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    estimatedDuration: "",
    isActive: true,
    tasks: [] as Task[]
  })
  
  const { toast } = useToast()

  useEffect(() => {
    fetchPlans()
  }, [])

  async function fetchPlans() {
    try {
      const response = await fetch("/api/cleaning-plans")
      if (!response.ok) throw new Error("Failed to fetch plans")
      const data = await response.json()
      // Convert isActive from smallint (0/1) to boolean
      const plansWithBooleanActive = data.map((plan: any) => ({
        ...plan,
        isActive: plan.isActive === 1 || plan.isActive === true,
        tasks: (plan.tasks || []).map((t: any) => ({
          ...t,
          name: t.title || t.name,
        }))
      }))
      setPlans(plansWithBooleanActive)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load cleaning plans",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setFormData({
      name: "",
      description: "",
      price: "",
      estimatedDuration: "",
      isActive: true,
      tasks: []
    })
    setCreateDialogOpen(true)
  }

  function openViewDialog(plan: CleaningPlan) {
    setSelectedPlan(plan)
    setViewDialogOpen(true)
  }

  function openEditDialog(plan: CleaningPlan) {
    setSelectedPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price || "",
      estimatedDuration: plan.estimatedDuration?.toString() || "",
      isActive: plan.isActive,
      tasks: plan.tasks.map((t, idx) => ({
        id: t.id,
        name: t.name,
        description: t.description || "",
        estimatedMinutes: t.estimatedMinutes || 0,
        order: t.order ?? idx
      }))
    })
    setEditDialogOpen(true)
  }

  function openDeleteDialog(plan: CleaningPlan) {
    setSelectedPlan(plan)
    setDeleteDialogOpen(true)
  }

  async function handleCreate() {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Plan name is required",
        variant: "destructive"
      })
      return
    }

    if (formData.tasks.length > 0 && formData.tasks.some((task) => !isTaskComplete(task))) {
      toast({
        title: "Complete all tasks",
        description: "Each task needs a title.",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/cleaning-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price: formData.price ? parseFloat(formData.price) : null,
          estimatedDuration: formData.estimatedDuration.trim() || null,
          isActive: formData.isActive,
          tasks: formData.tasks.map((t, idx) => ({
            name: t.name,
            description: t.description || null,
            estimatedMinutes: t.estimatedMinutes || null,
            order: idx
          }))
        })
      })

      if (!response.ok) throw new Error("Failed to create plan")

      toast({
        title: "Success",
        description: "Cleaning plan created successfully"
      })
      setCreateDialogOpen(false)
      fetchPlans()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create cleaning plan",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!selectedPlan || !formData.name.trim()) {
      toast({
        title: "Error",
        description: "Plan name is required",
        variant: "destructive"
      })
      return
    }

    if (formData.tasks.length > 0 && formData.tasks.some((task) => !isTaskComplete(task))) {
      toast({
        title: "Complete all tasks",
        description: "Each task needs a title.",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/cleaning-plans/${selectedPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price: formData.price ? parseFloat(formData.price) : null,
          estimatedDuration: formData.estimatedDuration.trim() || null,
          isActive: formData.isActive,
          tasks: formData.tasks.map((t, idx) => ({
            name: t.name,
            description: t.description || null,
            estimatedMinutes: t.estimatedMinutes || null,
            order: idx
          }))
        })
      })

      const updatedPlan = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(updatedPlan?.error || "Failed to update plan")
      }

      toast({
        title: "Success",
        description: "Cleaning plan updated successfully"
      })
      setEditDialogOpen(false)
      setCreateDialogOpen(false)
      setSelectedPlan(null)
      // Refetch to get properly formatted data
      fetchPlans()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update cleaning plan",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedPlan) return

    setSaving(true)
    try {
      const response = await fetch(`/api/cleaning-plans/${selectedPlan.id}`, {
        method: "DELETE"
      })

      if (!response.ok) throw new Error("Failed to delete plan")

      toast({
        title: "Success",
        description: "Cleaning plan deleted successfully"
      })
      setDeleteDialogOpen(false)
      fetchPlans()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete cleaning plan",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  async function togglePlanStatus(plan: CleaningPlan) {
    const newStatus = !plan.isActive
    try {
      const response = await fetch(`/api/cleaning-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus })
      })

      if (!response.ok) throw new Error("Failed to update status")

      setPlans((prev) => prev.map((p) => 
        p.id === plan.id ? { ...p, isActive: newStatus } : p
      ))

      toast({
        title: "Success",
        description: `Plan ${newStatus ? "activated" : "deactivated"} successfully`
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update plan status",
        variant: "destructive"
      })
    }
  }

  function addTask() {
    const lastTask = formData.tasks[formData.tasks.length - 1]
    if (lastTask && !isTaskComplete(lastTask)) {
      toast({
        title: "Complete the current task first",
        description: "Add a title before adding a new task.",
        variant: "destructive"
      })
      return
    }

    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { name: "", description: "", estimatedMinutes: 0, order: prev.tasks.length }]
    }))
  }

  function updateTask(index: number, field: keyof Task, value: string | number) {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((t, i) => i === index ? { ...t, [field]: value } : t)
    }))
  }

  function isTaskComplete(task: Task) {
    // Only task name is required - description and estimated minutes are optional
    return Boolean(task.name?.trim())
  }

  function removeTask(index: number) {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }))
  }

  function moveTask(index: number, direction: "up" | "down") {
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === formData.tasks.length - 1) return

    const newTasks = [...formData.tasks]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    ;[newTasks[index], newTasks[targetIndex]] = [newTasks[targetIndex], newTasks[index]]
    setFormData(prev => ({ ...prev, tasks: newTasks }))
  }

  function formatPrice(price: string | null) {
    if (!price) return "No price set"
    return `£${parseFloat(price).toFixed(2)}`
  }

  function formatDuration(value: string | number | null) {
    if (value === null || value === undefined) return "Not specified"

    let minutes: number | null = null

    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "Not specified"
      minutes = value
    } else {
      const trimmed = value.trim()
      if (!trimmed) return "Not specified"
      if (!/^\d+$/.test(trimmed)) return trimmed
      minutes = Number.parseInt(trimmed, 10)
    }

    if (minutes === null || !Number.isFinite(minutes)) return "Not specified"

    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins} min`
    if (mins === 0) return `${hours} hr`
    return `${hours} hr ${mins} min`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Your Cleaning Plans</h2>
          <p className="text-sm text-muted-foreground">
            {plans.length} plan{plans.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No cleaning plans yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first cleaning plan to get started
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {plan.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openViewDialog(plan)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(plan)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Plan
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => openDeleteDialog(plan)}
                        className="text-destructive"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete Plan
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">{formatPrice(plan.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{formatDuration(plan.estimatedDuration)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tasks:</span>
                    <Badge variant="secondary">{plan.tasks.length} items</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Active:</span>
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={() => togglePlanStatus(plan)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl sm:w-full">
          <DialogHeader>
            <DialogTitle>{selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              {selectedPlan?.description || "No description provided"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="font-medium">{formatPrice(selectedPlan?.price || null)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{formatDuration(selectedPlan?.estimatedDuration || null)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">{selectedPlan?.isActive ? "Active" : "Inactive"}</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Checklist ({selectedPlan?.tasks.length || 0} items)</h4>
              <ScrollArea className="h-[200px] border rounded-md p-3">
                {selectedPlan?.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks in this plan</p>
                ) : (
                  <div className="space-y-2">
                    {selectedPlan?.tasks
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((task, idx) => (
                        <div key={task.id || idx} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            {idx + 1}.
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{task.name}</p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground">{task.description}</p>
                            )}
                          </div>
                          {task.estimatedMinutes && task.estimatedMinutes > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {task.estimatedMinutes} min
                            </Badge>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false)
              if (selectedPlan) openEditDialog(selectedPlan)
            }}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={createDialogOpen || editDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false)
            setEditDialogOpen(false)
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {editDialogOpen ? "Edit Cleaning Plan" : "Create Cleaning Plan"}
            </DialogTitle>
            <DialogDescription>
              {editDialogOpen 
                ? "Update the cleaning plan details and checklist" 
                : "Create a new cleaning plan with tasks"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Standard Clean, Deep Clean"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this cleaning plan includes..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (£)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Estimated Duration</Label>
                  <Input
                    id="duration"
                    value={formData.estimatedDuration}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: e.target.value }))}
                    placeholder="e.g., 90 or 2-3 hours"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive" className="text-sm font-normal">
                  Plan is active and available for use
                </Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Checklist Tasks</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTask}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Task
                </Button>
              </div>
              
              {formData.tasks.length === 0 ? (
                <div className="text-center py-6 border rounded-md border-dashed">
                  <p className="text-sm text-muted-foreground">No tasks added yet</p>
                  <Button type="button" variant="ghost" size="sm" onClick={addTask} className="mt-2">
                    <Plus className="mr-1 h-3 w-3" />
                    Add your first task
                  </Button>
                </div>
              ) : (
                <div className="max-h-[240px] overflow-y-auto pr-2 pb-4">
                  <div className="space-y-3">
                    {formData.tasks.map((task, index) => (
                      <div key={index} className="border rounded-md p-3">
                        <div className="flex items-center justify-between sm:hidden">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveTask(index, "up")}
                            disabled={index === 0}
                          >
                            <GripVertical className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeTask(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                          <div className="hidden sm:flex flex-col gap-1 pt-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveTask(index, "up")}
                              disabled={index === 0}
                            >
                              <GripVertical className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 space-y-2">
                            <Input
                              value={task.name}
                              onChange={(e) => updateTask(index, "name", e.target.value)}
                              placeholder="Task name"
                              className="h-9"
                            />
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_90px]">
                              <Input
                                value={task.description || ""}
                                onChange={(e) => updateTask(index, "description", e.target.value)}
                                placeholder="Description (optional)"
                                className="h-9"
                              />
                              <Input
                                type="number"
                                min="0"
                                value={task.estimatedMinutes || ""}
                                onChange={(e) => updateTask(index, "estimatedMinutes", parseInt(e.target.value) || 0)}
                                placeholder="Min"
                                className="h-9"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="hidden sm:flex h-8 w-8 text-destructive"
                            onClick={() => removeTask(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCreateDialogOpen(false)
                setEditDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={editDialogOpen ? handleUpdate : handleCreate}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editDialogOpen ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cleaning Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPlan?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
