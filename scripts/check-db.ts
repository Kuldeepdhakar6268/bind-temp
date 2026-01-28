import { db, schema } from "../lib/db"
import { sql } from "drizzle-orm"

async function checkDatabase() {
  if (!db) {
    console.error("Database not connected")
    process.exit(1)
  }

  try {
    // Check if access_token column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quotes' AND column_name = 'access_token'
    `)
    
    console.log("Column check result:", result)
    
    if (result.length === 0) {
      console.log("access_token column NOT FOUND - running migration...")
      await db.execute(sql`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "access_token" varchar(255)`)
      console.log("Migration complete!")
    } else {
      console.log("access_token column exists!")
    }
    
    process.exit(0)
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  }
}

checkDatabase()
