import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL!)

// Generate a username from first and last name
function generateUsername(firstName: string, lastName: string, existingUsernames: Set<string>): string {
  // Clean and lowercase the names
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, "")
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, "")
  
  // Try different username formats
  const candidates = [
    `${cleanFirst}.${cleanLast}`,                    // john.doe
    `${cleanFirst}${cleanLast}`,                     // johndoe
    `${cleanFirst[0]}${cleanLast}`,                  // jdoe
    `${cleanFirst}${cleanLast[0]}`,                  // johnd
    `${cleanFirst}.${cleanLast}${Math.floor(Math.random() * 100)}`, // john.doe42
  ]
  
  for (const candidate of candidates) {
    if (!existingUsernames.has(candidate)) {
      existingUsernames.add(candidate)
      return candidate
    }
  }
  
  // If all else fails, add a random number
  let username = `${cleanFirst}.${cleanLast}${Date.now() % 1000}`
  while (existingUsernames.has(username)) {
    username = `${cleanFirst}.${cleanLast}${Math.floor(Math.random() * 10000)}`
  }
  existingUsernames.add(username)
  return username
}

async function generateEmployeeUsernames() {
  console.log("🔍 Finding employees without usernames...\n")

  try {
    // Get all employees without usernames
    const employeesWithoutUsername = await sql`
      SELECT id, first_name, last_name, email, company_id 
      FROM employees 
      WHERE username IS NULL OR username = ''
      ORDER BY company_id, id
    ` as Array<{ id: number; first_name: string; last_name: string; email: string; company_id: number }>

    if (employeesWithoutUsername.length === 0) {
      console.log("✅ All employees already have usernames!")
      return
    }

    console.log(`Found ${employeesWithoutUsername.length} employees without usernames:\n`)

    // Get all existing usernames per company
    const existingUsernames = await sql`
      SELECT company_id, username 
      FROM employees 
      WHERE username IS NOT NULL AND username != ''
    ` as Array<{ company_id: number; username: string }>

    // Build a map of existing usernames per company
    const usernamesByCompany = new Map<number, Set<string>>()
    for (const row of existingUsernames) {
      if (!usernamesByCompany.has(row.company_id)) {
        usernamesByCompany.set(row.company_id, new Set())
      }
      usernamesByCompany.get(row.company_id)!.add(row.username.toLowerCase())
    }

    // Generate and update usernames
    const updates: Array<{ id: number; name: string; username: string }> = []

    for (const employee of employeesWithoutUsername) {
      // Get or create the set for this company
      if (!usernamesByCompany.has(employee.company_id)) {
        usernamesByCompany.set(employee.company_id, new Set())
      }
      const companyUsernames = usernamesByCompany.get(employee.company_id)!

      const username = generateUsername(employee.first_name, employee.last_name, companyUsernames)
      
      updates.push({
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        username,
      })
    }

    // Display what will be updated
    console.log("Usernames to be generated:\n")
    console.log("┌─────┬────────────────────────────────┬────────────────────────┐")
    console.log("│ ID  │ Employee Name                  │ New Username           │")
    console.log("├─────┼────────────────────────────────┼────────────────────────┤")
    for (const update of updates) {
      const idStr = String(update.id).padEnd(3)
      const nameStr = update.name.padEnd(30).substring(0, 30)
      const usernameStr = update.username.padEnd(22).substring(0, 22)
      console.log(`│ ${idStr} │ ${nameStr} │ ${usernameStr} │`)
    }
    console.log("└─────┴────────────────────────────────┴────────────────────────┘\n")

    // Apply updates
    console.log("Applying updates...")
    for (const update of updates) {
      await sql`
        UPDATE employees 
        SET username = ${update.username}, updated_at = NOW() 
        WHERE id = ${update.id}
      `
      console.log(`  ✓ Updated employee #${update.id} (${update.name}) → ${update.username}`)
    }

    console.log(`\n✅ Successfully generated usernames for ${updates.length} employees!`)

  } catch (error) {
    console.error("❌ Error generating usernames:", error)
    throw error
  }
}

generateEmployeeUsernames()
  .then(() => {
    console.log("\n✅ Script completed successfully!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })
