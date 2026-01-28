import "dotenv/config"
import { db, schema } from "../lib/db"
import { hashPassword } from "../lib/auth"

async function seedTestCompanies() {
  console.log("🌱 Seeding test companies...")

  const testCompanies = [
    {
      company: {
        name: "CleanPro Services Ltd",
        email: "info@cleanpro.com",
        phone: "+44 20 1234 5678",
        address: "123 High Street",
        city: "London",
        postcode: "SW1A 1AA",
        businessType: "commercial",
        numberOfEmployees: 15,
      },
      admin: {
        firstName: "John",
        lastName: "Smith",
        email: "john@cleanpro.com",
        password: "password123",
      },
    },
    {
      company: {
        name: "Sparkle Clean Solutions",
        email: "contact@sparkle.com",
        phone: "+44 161 789 0123",
        address: "456 Market Street",
        city: "Manchester",
        postcode: "M1 1AA",
        businessType: "residential",
        numberOfEmployees: 8,
      },
      admin: {
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah@sparkle.com",
        password: "password123",
      },
    },
    {
      company: {
        name: "Elite Cleaning Group",
        email: "hello@elitecleaning.com",
        phone: "+44 121 456 7890",
        address: "789 Queen Street",
        city: "Birmingham",
        postcode: "B1 1AA",
        businessType: "both",
        numberOfEmployees: 25,
      },
      admin: {
        firstName: "Michael",
        lastName: "Brown",
        email: "michael@elitecleaning.com",
        password: "password123",
      },
    },
  ]

  for (const testData of testCompanies) {
    try {
      // Check if company already exists
      const existingCompany = await db.query.companies.findFirst({
        where: (companies, { eq }) => eq(companies.email, testData.company.email),
      })

      if (existingCompany) {
        console.log(`⏭️  Company ${testData.company.name} already exists, skipping...`)
        continue
      }

      // Calculate trial end date (15 days from now)
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 15)

      // Create company
      const [company] = await db
        .insert(schema.companies)
        .values({
          ...testData.company,
          subscriptionPlan: "trial",
          subscriptionStatus: "active",
          trialEndsAt,
        })
        .returning()

      console.log(`✅ Created company: ${company.name}`)

      // Hash password
      const passwordHash = await hashPassword(testData.admin.password)

      // Create admin user
      const [user] = await db
        .insert(schema.users)
        .values({
          companyId: company.id,
          email: testData.admin.email,
          passwordHash,
          firstName: testData.admin.firstName,
          lastName: testData.admin.lastName,
          role: "admin",
          isActive: true,
        })
        .returning()

      console.log(`✅ Created admin user: ${user.email}`)

      // Create some sample employees
      const sampleEmployees = [
        {
          firstName: "Emma",
          lastName: "Wilson",
          email: `emma.wilson@${testData.company.email.split("@")[1]}`,
          phone: "+44 7700 900001",
          role: "Team Leader",
          employmentType: "full-time",
          status: "active",
        },
        {
          firstName: "James",
          lastName: "Taylor",
          email: `james.taylor@${testData.company.email.split("@")[1]}`,
          phone: "+44 7700 900002",
          role: "Cleaner",
          employmentType: "full-time",
          status: "active",
        },
        {
          firstName: "Olivia",
          lastName: "Davis",
          email: `olivia.davis@${testData.company.email.split("@")[1]}`,
          phone: "+44 7700 900003",
          role: "Cleaner",
          employmentType: "part-time",
          status: "active",
        },
      ]

      for (const emp of sampleEmployees) {
        await db.insert(schema.employees).values({
          companyId: company.id,
          ...emp,
        })
      }

      console.log(`✅ Created ${sampleEmployees.length} sample employees\n`)
    } catch (error) {
      console.error(`❌ Error creating ${testData.company.name}:`, error)
    }
  }

  console.log("✨ Seeding complete!")
  console.log("\n📝 Test Accounts:")
  console.log("1. john@cleanpro.com / password123")
  console.log("2. sarah@sparkle.com / password123")
  console.log("3. michael@elitecleaning.com / password123")
}

seedTestCompanies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error)
    process.exit(1)
  })

