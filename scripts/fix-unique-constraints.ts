import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL!)

async function fixUniqueConstraints() {
  console.log("🔧 Fixing unique constraints for employees and customers...")

  try {
    // Drop old indexes
    console.log("Dropping old email indexes...")
    await sql`DROP INDEX IF EXISTS "employees_email_idx"`
    await sql`DROP INDEX IF EXISTS "customers_email_idx"`

    // Create new composite unique indexes for employees
    console.log("Creating new composite unique indexes for employees...")
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "employees_email_company_idx" ON "employees" ("company_id", "email")`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "employees_phone_company_idx" ON "employees" ("company_id", "phone") WHERE "phone" IS NOT NULL`

    // Create new composite unique indexes for customers
    console.log("Creating new composite unique indexes for customers...")
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_company_idx" ON "customers" ("company_id", "email")`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_company_idx" ON "customers" ("company_id", "phone") WHERE "phone" IS NOT NULL`

    console.log("✅ Unique constraints fixed successfully!")
    console.log("\nNow:")
    console.log("- Employees cannot have duplicate emails within the same company")
    console.log("- Employees cannot have duplicate phone numbers within the same company")
    console.log("- Customers cannot have duplicate emails within the same company")
    console.log("- Customers cannot have duplicate phone numbers within the same company")
  } catch (error) {
    console.error("❌ Error fixing unique constraints:", error)
    throw error
  }
}

fixUniqueConstraints()
  .then(() => {
    console.log("\n✅ Migration completed successfully!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error)
    process.exit(1)
  })

