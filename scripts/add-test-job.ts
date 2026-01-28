// Script to add a test job for an employee
// Run with: npx tsx scripts/add-test-job.ts

import { db } from "../lib/db"
import { employees, customers, jobs, jobTasks, companies } from "../lib/db/schema"
import { eq } from "drizzle-orm"

async function main() {
  console.log("Adding test job for employee...")

  // Get the first employee
  const employee = await db.query.employees.findFirst({
    orderBy: (employees, { asc }) => [asc(employees.id)]
  })

  if (!employee) {
    console.log("No employee found!")
    process.exit(1)
  }

  console.log(`Found employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.id})`)

  // Get or create a customer for the job
  let customer = await db.query.customers.findFirst({
    where: eq(customers.companyId, employee.companyId)
  })

  if (!customer) {
    // Create a test customer
    const [newCustomer] = await db.insert(customers).values({
      companyId: employee.companyId,
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@example.com",
      phone: "+44 7700 900123",
      address: "42 Baker Street",
      city: "London",
      postcode: "NW1 6XE",
      country: "UK",
      status: "active",
    }).returning()
    customer = newCustomer
    console.log(`Created customer: ${customer.firstName} ${customer.lastName}`)
  } else {
    console.log(`Using customer: ${customer.firstName} ${customer.lastName}`)
  }

  // Create a job scheduled for today
  const now = new Date()
  const scheduledStart = new Date(now)
  scheduledStart.setHours(10, 0, 0, 0)
  
  const scheduledEnd = new Date(scheduledStart)
  scheduledEnd.setHours(12, 0, 0, 0)

  const [job] = await db.insert(jobs).values({
    companyId: employee.companyId,
    title: "Deep Clean - Living Room & Kitchen",
    description: "Full deep cleaning service including carpet cleaning, kitchen appliance cleaning, and window cleaning.",
    jobType: "Deep Clean",
    customerId: customer.id,
    assignedTo: employee.id,
    location: customer.address || "42 Baker Street",
    city: customer.city || "London",
    postcode: customer.postcode || "NW1 6XE",
    accessInstructions: "Ring doorbell. Key is under the mat if no answer. Please lock up when finished.",
    scheduledFor: scheduledStart,
    scheduledEnd: scheduledEnd,
    durationMinutes: 120,
    status: "scheduled",
    priority: "normal",
    estimatedPrice: "85.00",
    currency: "GBP",
  }).returning()

  console.log(`Created job: ${job.title} (ID: ${job.id})`)

  // Add tasks to the job
  const tasks = [
    { title: "Vacuum all carpets and rugs", description: "Use the high-power setting for deep cleaning", order: 1 },
    { title: "Mop hard floors", description: "Use appropriate cleaning solution", order: 2 },
    { title: "Clean kitchen appliances", description: "Oven, microwave, fridge exterior", order: 3 },
    { title: "Clean kitchen surfaces", description: "Countertops, splashback, sink", order: 4 },
    { title: "Clean windows (interior)", description: "Living room and kitchen windows", order: 5 },
    { title: "Empty and clean bins", description: "Replace bin liners", order: 6 },
    { title: "Dust all surfaces", description: "Shelves, furniture, skirting boards", order: 7 },
  ]

  for (const task of tasks) {
    await db.insert(jobTasks).values({
      jobId: job.id,
      title: task.title,
      description: task.description,
      order: task.order,
      status: "pending",
    })
  }

  console.log(`Added ${tasks.length} tasks to the job`)

  // Create another job for tomorrow
  const tomorrowStart = new Date(now)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  tomorrowStart.setHours(14, 0, 0, 0)

  const tomorrowEnd = new Date(tomorrowStart)
  tomorrowEnd.setHours(16, 0, 0, 0)

  const [job2] = await db.insert(jobs).values({
    companyId: employee.companyId,
    title: "Regular Cleaning - 2 Bedroom Flat",
    description: "Weekly regular cleaning service.",
    jobType: "Regular Clean",
    customerId: customer.id,
    assignedTo: employee.id,
    location: "15 Oxford Street",
    city: "London",
    postcode: "W1D 2DW",
    accessInstructions: "Concierge will let you in. Flat 4B on the 2nd floor.",
    scheduledFor: tomorrowStart,
    scheduledEnd: tomorrowEnd,
    durationMinutes: 120,
    status: "scheduled",
    priority: "normal",
    estimatedPrice: "65.00",
    currency: "GBP",
  }).returning()

  console.log(`Created job: ${job2.title} (ID: ${job2.id})`)

  // Add tasks for job2
  const tasks2 = [
    { title: "Bathroom cleaning", description: "Toilet, sink, shower, mirror", order: 1 },
    { title: "Bedroom 1 cleaning", description: "Dust, vacuum, make bed", order: 2 },
    { title: "Bedroom 2 cleaning", description: "Dust, vacuum, make bed", order: 3 },
    { title: "Living area", description: "Dust, vacuum, tidy", order: 4 },
    { title: "Kitchen", description: "Surfaces, appliances, floor", order: 5 },
  ]

  for (const task of tasks2) {
    await db.insert(jobTasks).values({
      jobId: job2.id,
      title: task.title,
      description: task.description,
      order: task.order,
      status: "pending",
    })
  }

  console.log(`Added ${tasks2.length} tasks to job 2`)

  console.log("\n✅ Test jobs created successfully!")
  console.log(`\nEmployee ${employee.firstName} ${employee.lastName} now has 2 jobs assigned:`)
  console.log(`1. ${job.title} - Today`)
  console.log(`2. ${job2.title} - Tomorrow`)

  process.exit(0)
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
