import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { sql } from "drizzle-orm"

const connectionString = process.env.DATABASE_URL!
console.log("Connecting to database...")

const queryClient = postgres(connectionString)
const db = drizzle(queryClient)

async function pushSchema() {
  try {
    // Check if columns exist first and add them if they don't
    
    // Add number_of_employees
    try {
      await db.execute(sql`
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS number_of_employees integer DEFAULT 1
      `)
      console.log("✅ number_of_employees column ready")
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("✅ number_of_employees column already exists")
      } else {
        console.log("⚠️ number_of_employees:", e.message)
      }
    }

    // Add stripe_customer_id
    try {
      await db.execute(sql`
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(255)
      `)
      console.log("✅ stripe_customer_id column ready")
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("✅ stripe_customer_id column already exists")
      } else {
        console.log("⚠️ stripe_customer_id:", e.message)
      }
    }

    // Add stripe_subscription_id
    try {
      await db.execute(sql`
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(255)
      `)
      console.log("✅ stripe_subscription_id column ready")
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("✅ stripe_subscription_id column already exists")
      } else {
        console.log("⚠️ stripe_subscription_id:", e.message)
      }
    }

    // Create job_templates table if not exists
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS job_templates (
          id serial PRIMARY KEY NOT NULL,
          company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          name varchar(255) NOT NULL,
          description text,
          category varchar(100),
          default_duration integer,
          default_price numeric(12, 2),
          tasks text,
          is_active smallint DEFAULT 1,
          created_at timestamp DEFAULT now() NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL
        )
      `)
      console.log("✅ job_templates table ready")
    } catch (e: any) {
      console.log("⚠️ job_templates:", e.message)
    }

    // Create indexes for job_templates
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS job_templates_company_idx ON job_templates (company_id)`)
      await db.execute(sql`CREATE INDEX IF NOT EXISTS job_templates_category_idx ON job_templates (category)`)
      console.log("✅ job_templates indexes ready")
    } catch (e: any) {
      console.log("⚠️ job_templates indexes:", e.message)
    }

    console.log("\n✅ Database schema push complete!")
    
  } catch (error) {
    console.error("Error pushing schema:", error)
    throw error
  } finally {
    await queryClient.end()
  }
}

pushSchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
