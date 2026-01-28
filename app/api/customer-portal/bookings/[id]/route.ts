import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookingRequests, companies, customers, employees, jobs } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { isCompanyNotificationEnabled } from "@/lib/notification-settings"
import { verify } from "jsonwebtoken"
import { 
  sendBookingCancelledEmail, 
  sendBookingModifiedEmail,
  sendBookingCancelledToCompanyEmail,
  sendBookingModifiedToCompanyEmail
} from "@/lib/email"

const JWT_SECRET = process.env.NEXTAUTH_SECRET

/**
 * GET /api/customer-portal/bookings/[id]
 * Get a specific booking request details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    if (!JWT_SECRET) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    let decoded: any
    try {
      decoded = verify(token, JWT_SECRET)
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!decoded.customerId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id } = await params
    const bookingId = parseInt(id)

    if (isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 })
    }

    // Fetch the booking with company details
    const result = await db
      .select({
        booking: bookingRequests,
        company: {
          id: companies.id,
          name: companies.name,
          email: companies.email,
          phone: companies.phone,
        },
      })
      .from(bookingRequests)
      .leftJoin(companies, eq(bookingRequests.companyId, companies.id))
      .where(
        and(
          eq(bookingRequests.id, bookingId),
          eq(bookingRequests.customerId, decoded.customerId)
        )
      )
      .limit(1)

    if (result.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error fetching booking:", error)
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/customer-portal/bookings/[id]
 * Update a booking request (edit or cancel)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    if (!JWT_SECRET) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    let decoded: any
    try {
      decoded = verify(token, JWT_SECRET)
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!decoded.customerId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id } = await params
    const bookingId = parseInt(id)

    if (isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 })
    }

    const body = await request.json()
    const { action, cancellationReason, ...updateData } = body

    // Fetch the existing booking
    const existingBooking = await db
      .select({
        booking: bookingRequests,
        company: {
          id: companies.id,
          name: companies.name,
          email: companies.email,
        },
      })
      .from(bookingRequests)
      .leftJoin(companies, eq(bookingRequests.companyId, companies.id))
      .where(
        and(
          eq(bookingRequests.id, bookingId),
          eq(bookingRequests.customerId, decoded.customerId)
        )
      )
      .limit(1)

    if (existingBooking.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const { booking, company } = existingBooking[0]

    // Check if booking can be modified
    const nonModifiableStatuses = ["converted", "cancelled", "declined"]
    if (nonModifiableStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: `Cannot modify a ${booking.status} booking` },
        { status: 400 }
      )
    }

    // Check if preferred date is in the past for cancellations
    if (action === "cancel" && booking.preferredDate) {
      const preferredDate = new Date(booking.preferredDate)
      const now = new Date()
      const hoursUntilJob = (preferredDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      // Allow cancellation but warn if less than 24 hours
      if (hoursUntilJob < 0) {
        return NextResponse.json(
          { error: "Cannot cancel a booking for a past date" },
          { status: 400 }
        )
      }
    }

    // Handle cancellation
    if (action === "cancel") {
      await db
        .update(bookingRequests)
        .set({
          status: "cancelled",
          adminNotes: booking.adminNotes 
            ? `${booking.adminNotes}\n\n[Customer Cancelled - ${new Date().toISOString()}]\nReason: ${cancellationReason || "No reason provided"}`
            : `[Customer Cancelled - ${new Date().toISOString()}]\nReason: ${cancellationReason || "No reason provided"}`,
          updatedAt: new Date(),
        })
        .where(eq(bookingRequests.id, bookingId))

      // Send cancellation email to customer
      try {
        await sendBookingCancelledEmail({
          customerEmail: booking.customerEmail,
          customerName: `${booking.customerFirstName} ${booking.customerLastName}`,
          bookingId: booking.id,
          serviceType: booking.serviceType,
          preferredDate: booking.preferredDate,
          companyName: company?.name || "Our cleaning team",
        })
      } catch (emailError) {
        console.error("Failed to send customer cancellation email:", emailError)
      }

      // Send cancellation notification to company
      if (company?.email && isCompanyNotificationEnabled(company.notificationSettings, "bookingUpdates")) {
        try {
          await sendBookingCancelledToCompanyEmail({
            companyEmail: company.email,
            companyName: company.name,
            customerName: `${booking.customerFirstName} ${booking.customerLastName}`,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone || undefined,
            bookingId: booking.id,
            serviceType: booking.serviceType,
            preferredDate: booking.preferredDate,
            address: booking.address,
            city: booking.city || undefined,
            cancellationReason: cancellationReason || "No reason provided",
          })
        } catch (emailError) {
          console.error("Failed to send company cancellation email:", emailError)
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: "Booking cancelled successfully",
        booking: { ...booking, status: "cancelled" }
      })
    }

    // Handle edit
    if (action === "edit") {
      const allowedFields = [
        "preferredDate",
        "preferredTimeSlot",
        "alternateDate",
        "specialRequirements",
        "accessInstructions",
        "address",
        "addressLine2",
        "city",
        "postcode",
      ]

      const updateFields: Record<string, any> = {
        updatedAt: new Date(),
      }

      // Track what changed for the email
      const changes: string[] = []

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          const oldValue = booking[field as keyof typeof booking]
          let newValue = updateData[field]
          
          // Handle date fields - convert to Date object or null
          if (field === "preferredDate" || field === "alternateDate") {
            if (newValue && typeof newValue === "string" && newValue.trim() !== "") {
              try {
                newValue = new Date(newValue)
                // Check if valid date
                if (isNaN(newValue.getTime())) {
                  newValue = null
                }
              } catch {
                newValue = null
              }
            } else {
              newValue = null
            }
          }
          
          // Handle string fields - convert empty strings to null for optional fields
          if (typeof newValue === "string" && newValue.trim() === "" && field !== "address") {
            newValue = null
          }
          
          // Compare values (convert dates to timestamps for comparison)
          const oldValueForCompare = oldValue instanceof Date ? oldValue.getTime() : oldValue
          const newValueForCompare = newValue instanceof Date ? newValue.getTime() : newValue
          
          if (oldValueForCompare !== newValueForCompare) {
            updateFields[field] = newValue
            
            // Format change for email
            if (field === "preferredDate") {
              const oldDate = oldValue ? new Date(oldValue as string).toLocaleDateString("en-GB") : "Not set"
              const newDate = newValue ? new Date(newValue).toLocaleDateString("en-GB") : "Not set"
              changes.push(`Preferred Date: ${oldDate} → ${newDate}`)
            } else if (field === "preferredTimeSlot") {
              changes.push(`Time Slot: ${oldValue || "Not set"} → ${newValue || "Not set"}`)
            } else if (field === "address" || field === "city" || field === "postcode") {
              changes.push(`Address updated`)
            } else if (field === "specialRequirements") {
              changes.push(`Special requirements updated`)
            } else if (field === "accessInstructions") {
              changes.push(`Access instructions updated`)
            }
          }
        }
      }

      if (Object.keys(updateFields).length === 1) { // Only updatedAt
        return NextResponse.json({ 
          success: true, 
          message: "No changes made",
          booking 
        })
      }

      // Add note about the edit
      updateFields.adminNotes = booking.adminNotes
        ? `${booking.adminNotes}\n\n[Customer Edited - ${new Date().toISOString()}]\nChanges: ${changes.join(", ")}`
        : `[Customer Edited - ${new Date().toISOString()}]\nChanges: ${changes.join(", ")}`

      await db
        .update(bookingRequests)
        .set(updateFields)
        .where(eq(bookingRequests.id, bookingId))

      // Send modification email to customer
      try {
        await sendBookingModifiedEmail({
          customerEmail: booking.customerEmail,
          customerName: `${booking.customerFirstName} ${booking.customerLastName}`,
          bookingId: booking.id,
          serviceType: booking.serviceType,
          changes,
          newPreferredDate: updateFields.preferredDate || booking.preferredDate,
          companyName: company?.name || "Our cleaning team",
        })
      } catch (emailError) {
        console.error("Failed to send customer modification email:", emailError)
      }

      // Send modification notification to company
      if (company?.email && isCompanyNotificationEnabled(company.notificationSettings, "bookingUpdates")) {
        try {
          await sendBookingModifiedToCompanyEmail({
            companyEmail: company.email,
            companyName: company.name,
            customerName: `${booking.customerFirstName} ${booking.customerLastName}`,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone || undefined,
            bookingId: booking.id,
            serviceType: booking.serviceType,
            changes,
            newPreferredDate: updateFields.preferredDate || booking.preferredDate,
            address: updateFields.address || booking.address,
            city: updateFields.city || booking.city || undefined,
          })
        } catch (emailError) {
          console.error("Failed to send company modification email:", emailError)
        }
      }

      // Fetch updated booking
      const updatedBooking = await db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, bookingId))
        .limit(1)

      return NextResponse.json({ 
        success: true, 
        message: "Booking updated successfully",
        booking: updatedBooking[0],
        changes
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating booking:", error)
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    )
  }
}
