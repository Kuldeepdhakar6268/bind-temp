const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

// Remove quotes if present
const dbUrl = process.env.DATABASE_URL.replace(/^"|"$/g, '');
const sql = postgres(dbUrl);

async function migrate() {
  try {
    // Create sessions table
    await sql`CREATE TABLE IF NOT EXISTS sessions (
      id serial PRIMARY KEY,
      token varchar(255) NOT NULL,
      user_id integer REFERENCES users(id) ON DELETE CASCADE,
      employee_id integer,
      company_id integer REFERENCES companies(id) ON DELETE CASCADE,
      type varchar(20) DEFAULT 'user' NOT NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    )`;
    console.log('✓ sessions table');

    // Create event_logs table
    await sql`CREATE TABLE IF NOT EXISTS event_logs (
      id serial PRIMARY KEY,
      company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      event_type varchar(100) NOT NULL,
      entity_type varchar(50),
      entity_id integer,
      user_id integer,
      employee_id integer,
      description text,
      metadata text,
      ip_address varchar(45),
      user_agent text,
      created_at timestamp DEFAULT now() NOT NULL
    )`;
    console.log('✓ event_logs table');

    // Create customer_feedback table
    await sql`CREATE TABLE IF NOT EXISTS customer_feedback (
      id serial PRIMARY KEY,
      company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      customer_id integer,
      job_id integer,
      rating integer NOT NULL,
      comment text,
      feedback_token varchar(255),
      submitted_at timestamp DEFAULT now() NOT NULL,
      responded_at timestamp,
      response text,
      created_at timestamp DEFAULT now() NOT NULL
    )`;
    console.log('✓ customer_feedback table');

    // Add columns
    await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS feedback_token varchar(255)`;
    console.log('✓ jobs.feedback_token column');

    await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS access_token varchar(255)`;
    console.log('✓ quotes.access_token column');

    // Create indexes
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token)`;
    await sql`CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at)`;
    await sql`CREATE INDEX IF NOT EXISTS jobs_feedback_token_idx ON jobs(feedback_token)`;
    await sql`CREATE INDEX IF NOT EXISTS quotes_access_token_idx ON quotes(access_token)`;
    console.log('✓ indexes created');

    console.log('\n✅ Migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}
migrate();
