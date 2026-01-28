-- Create sessions table
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "token" varchar(255) NOT NULL,
    "user_id" integer,
    "employee_id" integer,
    "company_id" integer,
    "type" varchar(20) DEFAULT 'user' NOT NULL,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create event_logs table
CREATE TABLE IF NOT EXISTS "event_logs" (
    "id" serial PRIMARY KEY NOT NULL,
    "company_id" integer NOT NULL,
    "event_type" varchar(100) NOT NULL,
    "entity_type" varchar(50),
    "entity_id" integer,
    "user_id" integer,
    "employee_id" integer,
    "description" text,
    "metadata" text,
    "ip_address" varchar(45),
    "user_agent" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create customer_feedback table
CREATE TABLE IF NOT EXISTS "customer_feedback" (
    "id" serial PRIMARY KEY NOT NULL,
    "company_id" integer NOT NULL,
    "customer_id" integer,
    "job_id" integer,
    "rating" integer NOT NULL,
    "comment" text,
    "feedback_token" varchar(255),
    "submitted_at" timestamp DEFAULT now() NOT NULL,
    "responded_at" timestamp,
    "response" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add columns to jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "feedback_token" varchar(255);

-- Add columns to quotes  
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "access_token" varchar(255);

-- Create customer_addresses table
CREATE TABLE IF NOT EXISTS "customer_addresses" (
    "id" serial PRIMARY KEY NOT NULL,
    "customer_id" integer NOT NULL,
    "label" varchar(100),
    "address" text NOT NULL,
    "address_line_2" text,
    "city" varchar(100),
    "postcode" varchar(50),
    "country" varchar(100) DEFAULT 'UK',
    "access_instructions" text,
    "parking_instructions" text,
    "special_instructions" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add per-address instructions to existing tables
ALTER TABLE "customer_addresses" ADD COLUMN IF NOT EXISTS "access_instructions" text;
ALTER TABLE "customer_addresses" ADD COLUMN IF NOT EXISTS "parking_instructions" text;
ALTER TABLE "customer_addresses" ADD COLUMN IF NOT EXISTS "special_instructions" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "parking_instructions" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "special_instructions" text;

-- Add foreign keys
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;

-- Add indexes
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_employee_idx" ON "sessions" USING btree ("employee_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "customer_feedback_company_idx" ON "customer_feedback" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "customer_feedback_customer_idx" ON "customer_feedback" USING btree ("customer_id");
CREATE INDEX IF NOT EXISTS "customer_feedback_job_idx" ON "customer_feedback" USING btree ("job_id");
CREATE INDEX IF NOT EXISTS "customer_feedback_token_idx" ON "customer_feedback" USING btree ("feedback_token");
CREATE INDEX IF NOT EXISTS "event_logs_company_idx" ON "event_logs" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "event_logs_event_type_idx" ON "event_logs" USING btree ("event_type");
CREATE INDEX IF NOT EXISTS "event_logs_entity_idx" ON "event_logs" USING btree ("entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "event_logs_created_idx" ON "event_logs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "jobs_feedback_token_idx" ON "jobs" USING btree ("feedback_token");
CREATE INDEX IF NOT EXISTS "quotes_access_token_idx" ON "quotes" USING btree ("access_token");
CREATE INDEX IF NOT EXISTS "customer_addresses_customer_idx" ON "customer_addresses" USING btree ("customer_id");
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "notification_settings" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "pay_type" varchar(20) DEFAULT 'hourly';
CREATE TABLE IF NOT EXISTS "job_assignments" (
  "id" serial PRIMARY KEY,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "employee_id" integer NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "pay_amount" decimal(10,2),
  "status" varchar(50) NOT NULL DEFAULT 'assigned',
  "accepted_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "job_assignments_job_idx" ON "job_assignments"("job_id");
CREATE INDEX IF NOT EXISTS "job_assignments_employee_idx" ON "job_assignments"("employee_id");
CREATE INDEX IF NOT EXISTS "job_assignments_company_idx" ON "job_assignments"("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "job_assignments_unique" ON "job_assignments"("job_id","employee_id");

-- Allow null employee_pay (per-job pay now lives on job_assignments when multi-assigning)
ALTER TABLE "jobs" ALTER COLUMN "employee_pay" DROP NOT NULL;
