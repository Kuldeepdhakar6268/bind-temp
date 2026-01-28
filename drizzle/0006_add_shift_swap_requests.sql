CREATE TABLE IF NOT EXISTS "shift_swap_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "from_employee_id" integer NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "to_employee_id" integer NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "from_job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "to_job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE cascade,
  "requested_by_employee_id" integer REFERENCES "employees"("id") ON DELETE set null,
  "requested_by_role" varchar(20) NOT NULL DEFAULT 'company',
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "reason" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shift_swap_requests_company_idx" ON "shift_swap_requests" ("company_id");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_status_idx" ON "shift_swap_requests" ("status");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_from_employee_idx" ON "shift_swap_requests" ("from_employee_id");
CREATE INDEX IF NOT EXISTS "shift_swap_requests_to_employee_idx" ON "shift_swap_requests" ("to_employee_id");
