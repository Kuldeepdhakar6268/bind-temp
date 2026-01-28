import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { sql } from "drizzle-orm"

const connectionString = process.env.DATABASE_URL!
const queryClient = postgres(connectionString)
const db = drizzle(queryClient)

async function addStripeColumns() {
  try {
    // Add number_of_employees if not exists
    await db.execute(sql`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS number_of_employees integer DEFAULT 1
    `)
    console.log("✅ Added number_of_employees column")

    // Add stripe_customer_id if not exists
    await db.execute(sql`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(255)
    `)
    console.log("✅ Added stripe_customer_id column")

    // Add stripe_subscription_id if not exists
    await db.execute(sql`
      ALTER TABLE companies 
      ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(255)
    `)
    console.log("✅ Added stripe_subscription_id column")

    console.log("✅ Migration complete!")
  } catch (error) {
    console.error("Migration error:", error)
    throw error
  }
}

addStripeColumns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
