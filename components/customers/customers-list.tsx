"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Phone, Mail, MapPin, Edit2, UserX, UserCheck, Loader2 } from "lucide-react"
import { EditCustomerDialog } from "./edit-customer-dialog"
import { DeleteCustomerDialog } from "./delete-customer-dialog"

interface Customer {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  alternatePhone?: string | null
  customerType: string
  address?: string | null
  addressLine2?: string | null
  city?: string | null
  postcode?: string | null
  country?: string | null
  billingAddress?: string | null
  billingCity?: string | null
  billingPostcode?: string | null
  billingCountry?: string | null
  companyName?: string | null
  businessType?: string | null
  taxId?: string | null
  preferredContactMethod?: string | null
  specialInstructions?: string | null
  accessInstructions?: string | null
  parkingInstructions?: string | null
  source?: string | null
  referredBy?: string | null
  notes?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export function CustomersList() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/customers")
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const filteredCustomers = useMemo(() => {
    const term = search.toLowerCase()
    return customers.filter(
      (customer) =>
        customer.firstName.toLowerCase().includes(term) ||
        customer.lastName.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term) ||
        (customer.phone ?? "").toLowerCase().includes(term) ||
        (customer.city ?? "").toLowerCase().includes(term) ||
        (customer.companyName ?? "").toLowerCase().includes(term),
    )
  }, [customers, search])

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>All Customers ({customers.length})</CardTitle>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredCustomers.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    {search ? "No customers found matching your search" : "No customers yet"}
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <div key={customer.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {customer.firstName} {customer.lastName}
                          </div>
                          {customer.companyName && (
                            <div className="text-xs text-muted-foreground">{customer.companyName}</div>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {customer.customerType}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <a
                          href={`mailto:${customer.email}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </a>
                        {customer.phone && (
                          <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:underline">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </a>
                        )}
                        {customer.city && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {customer.city}
                          </div>
                        )}
                        <div>
                          <Badge
                            variant={
                              customer.status === "active"
                                ? "default"
                                : customer.status === "inactive"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {customer.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingCustomer(customer)}>
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant={customer.status === "inactive" ? "outline" : "destructive"}
                          size="sm"
                          className="flex-1"
                          onClick={() => setDeletingCustomer(customer)}
                        >
                          {customer.status === "inactive" ? (
                            <UserCheck className="h-4 w-4 mr-1" />
                          ) : (
                            <UserX className="h-4 w-4 mr-1" />
                          )}
                          {customer.status === "inactive" ? "Reactivate" : "Deactivate"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {search ? "No customers found matching your search" : "No customers yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>
                              {customer.firstName} {customer.lastName}
                            </div>
                            {customer.companyName && (
                              <div className="text-xs text-muted-foreground">{customer.companyName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {customer.customerType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`mailto:${customer.email}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </a>
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:underline">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </a>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.city ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {customer.city}
                            </div>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              customer.status === "active"
                                ? "default"
                                : customer.status === "inactive"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {customer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingCustomer(customer)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={customer.status === "inactive" ? "outline" : "destructive"}
                              size="icon"
                              onClick={() => setDeletingCustomer(customer)}
                            >
                              {customer.status === "inactive" ? (
                                <UserCheck className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EditCustomerDialog
        open={!!editingCustomer}
        onOpenChange={(open) => !open && setEditingCustomer(null)}
        customer={editingCustomer}
        onSuccess={fetchCustomers}
      />

      <DeleteCustomerDialog
        open={!!deletingCustomer}
        onOpenChange={(open) => !open && setDeletingCustomer(null)}
        customer={deletingCustomer}
        onSuccess={fetchCustomers}
      />
    </>
  )
}




