import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL!)

async function addEmployeeCredentials() {
  console.log("🔧 Adding username and password columns to employees table...")

  try {
    // Add username column
    console.log("Adding username column...")
    await sql`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "username" TEXT`

    // Add password column
    console.log("Adding password column...")
    await sql`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "password" TEXT`

    // Create unique index for username per company
    console.log("Creating unique index for username...")
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "employees_username_company_idx" ON "employees" ("company_id", "username") WHERE "username" IS NOT NULL`

    console.log("✅ Employee credentials columns added successfully!")
    console.log("\nNew columns:")
    console.log("- username: TEXT (unique per company)")
    console.log("- password: TEXT (hashed)")
  } catch (error) {
    console.error("❌ Error adding employee credentials:", error)
    throw error
  }
}

addEmployeeCredentials()
  .then(() => {
    console.log("\n✅ Migration completed successfully!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error)
    process.exit(1)
  })

