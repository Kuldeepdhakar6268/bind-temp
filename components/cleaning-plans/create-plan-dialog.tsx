"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"

interface CreatePlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePlanDialog({ open, onOpenChange }: CreatePlanDialogProps) {
  const [tasks, setTasks] = useState([{ id: 1, name: "" }])

  const addTask = () => {
    setTasks([...tasks, { id: tasks.length + 1, name: "" }])
  }

  const removeTask = (id: number) => {
    setTasks(tasks.filter((task) => task.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Cleaning Plan</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="planName">Plan Name</Label>
            <Input id="planName" placeholder="e.g., Office Deep Clean" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Brief description of this cleaning plan..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="restroom">Restroom</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                  <SelectItem value="windows">Windows</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Estimated Duration</Label>
              <Input id="duration" placeholder="e.g., 2-3 hours" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tasks Checklist</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTask}>
                <Plus className="h-4 w-4 mr-1" />
                Add Task
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tasks.map((task, index) => (
                <div key={task.id} className="flex gap-2">
                  <Input placeholder={`Task ${index + 1}`} className="flex-1" />
                  {tasks.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTask(task.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Create Plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
