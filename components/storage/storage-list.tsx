"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, AlertCircle, Edit2, Loader2, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Supply {
  id: number
  name: string
  description: string | null
  category: string | null
  sku: string | null
  quantity: number
  unit: string | null
  minQuantity: number | null
  unitCost: string | null
  supplier: string | null
  status: string
  notes: string | null
}

const categoryColors: Record<string, string> = {
  Cleaning: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  Supplies: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  Equipment: "bg-chart-4/10 text-chart-4 border-chart-4/20",
}

interface StorageListProps {
  addRequestKey?: number
}

export function StorageList({ addRequestKey }: StorageListProps) {
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<Supply | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    category: "Cleaning",
    quantity: 0,
    unit: "bottles",
    minQuantity: 5,
    unitCost: "",
    supplier: "",
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hasHandledInitialAddRequest = useRef(false)

  async function fetchSupplies() {
    try {
      const response = await fetch("/api/supplies")
      if (!response.ok) throw new Error("Failed to fetch supplies")
      const data = await response.json()
      setSupplies(data)
    } catch (err) {
      console.error("Error fetching supplies:", err)
      setError("Failed to load inventory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSupplies()
  }, [])

  useEffect(() => {
    if (addRequestKey === undefined) return
    if (!hasHandledInitialAddRequest.current) {
      hasHandledInitialAddRequest.current = true
      return
    }
    openNewDialog()
  }, [addRequestKey])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const url = editingItem ? `/api/supplies/${editingItem.id}` : "/api/supplies"
      const method = editingItem ? "PATCH" : "POST"
      const payload = {
        name: formData.name.trim(),
        category: formData.category || null,
        quantity: Number.isFinite(Number(formData.quantity)) ? Math.max(0, Number(formData.quantity)) : 0,
        unit: formData.unit || null,
        minQuantity: Number.isFinite(Number(formData.minQuantity)) ? Math.max(0, Number(formData.minQuantity)) : 5,
        unitCost: typeof formData.unitCost === "string" && formData.unitCost.trim() === "" ? null : formData.unitCost,
        supplier: typeof formData.supplier === "string" && formData.supplier.trim() === "" ? null : formData.supplier,
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to save")
      }

      setIsDialogOpen(false)
      setEditingItem(null)
      setFormData({
        name: "",
        category: "Cleaning",
        quantity: 0,
        unit: "bottles",
        minQuantity: 5,
        unitCost: "",
        supplier: "",
      })
      fetchSupplies()
    } catch (err) {
      console.error("Error saving supply:", err)
      setSaveError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  function openEditDialog(item: Supply) {
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: item.category || "Cleaning",
      quantity: item.quantity,
      unit: item.unit || "bottles",
      minQuantity: item.minQuantity || 5,
      unitCost: item.unitCost || "",
      supplier: item.supplier || "",
    })
    setIsDialogOpen(true)
  }

  function openNewDialog() {
    setEditingItem(null)
    setFormData({
      name: "",
      category: "Cleaning",
      quantity: 0,
      unit: "bottles",
      minQuantity: 5,
      unitCost: "",
      supplier: "",
    })
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {error}
      </div>
    )
  }

  if (supplies.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No inventory items</h3>
        <p className="text-muted-foreground mb-4">Get started by adding your first supply item</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Multi-Surface Cleaner"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cleaning">Cleaning</SelectItem>
                      <SelectItem value="Supplies">Supplies</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottles">bottles</SelectItem>
                      <SelectItem value="pieces">pieces</SelectItem>
                      <SelectItem value="boxes">boxes</SelectItem>
                      <SelectItem value="packs">packs</SelectItem>
                      <SelectItem value="liters">liters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minQuantity">Low Stock Alert</Label>
                  <Input
                    id="minQuantity"
                    type="number"
                    min="0"
                    value={formData.minQuantity}
                    onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving || !formData.name}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Update Stock" : "Add New Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Multi-Surface Cleaner"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cleaning">Cleaning</SelectItem>
                    <SelectItem value="Supplies">Supplies</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottles">bottles</SelectItem>
                    <SelectItem value="pieces">pieces</SelectItem>
                    <SelectItem value="boxes">boxes</SelectItem>
                    <SelectItem value="packs">packs</SelectItem>
                    <SelectItem value="liters">liters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minQuantity">Low Stock Alert</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  min="0"
                  value={formData.minQuantity}
                  onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving || !formData.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingItem ? "Update" : "Add Item"}
            </Button>
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {supplies.map((item) => {
          const isLowStock = item.status === "low-stock" || item.status === "out-of-stock"
          const categoryColor = categoryColors[item.category || "Supplies"] || categoryColors.Supplies

          return (
            <Card
              key={item.id}
              className={`hover:shadow-md transition-shadow ${isLowStock ? "border-destructive/50" : ""}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isLowStock ? "bg-destructive/10" : "bg-primary/10"
                    }`}
                  >
                    {isLowStock ? (
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    ) : (
                      <Package className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <Badge className={categoryColor}>{item.category || "Supplies"}</Badge>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">{item.name}</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{item.quantity}</span>
                    <span className="text-sm text-muted-foreground">{item.unit || "units"}</span>
                  </div>
                  {isLowStock && (
                    <div className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {item.status === "out-of-stock" ? "Out of stock" : "Low stock - reorder soon"}
                    </div>
                  )}
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4 bg-transparent"
                  onClick={() => openEditDialog(item)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Update Stock
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
