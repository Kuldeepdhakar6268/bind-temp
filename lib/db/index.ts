import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const rawConnectionString = process.env.DATABASE_URL?.trim()

type DbClient = ReturnType<typeof postgres>
type DbInstance = ReturnType<typeof drizzle<typeof schema>>

let client: DbClient | null = null
let database: DbInstance | null = null

const isPlaceholder = rawConnectionString === "your_database_url_here"

const isValidPostgresUrl = (value: string | undefined) => {
  if (!value || isPlaceholder) return false

  try {
    const url = new URL(value)
    return url.protocol === "postgresql:" || url.protocol === "postgres:"
  } catch {
    return false
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __dbClient?: DbClient
  __dbInstance?: DbInstance
}

// Only create the database client when a valid connection string is present so builds
// without env vars don't crash. Callers should handle the `null` case.
if (isValidPostgresUrl(rawConnectionString)) {
  if (!globalForDb.__dbClient) {
    globalForDb.__dbClient = postgres(rawConnectionString, {
      prepare: false,
      max: 2,
      idle_timeout: 30,
    })
    globalForDb.__dbInstance = drizzle(globalForDb.__dbClient, { schema })
  }

  client = globalForDb.__dbClient
  database = globalForDb.__dbInstance ?? null
} else {
  console.warn(
    "DATABASE_URL is missing or invalid. Set a valid PostgreSQL connection string in .env.local (see DATABASE_SETUP.md).",
  )
}

export const db = database

export async function pingDb() {
  if (!client) return false

  const result = await client`SELECT 1 as result`
  return Array.isArray(result) && result[0]?.result === 1
}

export { schema }
