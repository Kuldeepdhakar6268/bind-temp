-- Migration: Add booking_requests table for customer booking flow
-- This table stores customer-submitted booking requests before they are converted to jobs

CREATE TABLE IF NOT EXISTS "booking_requests" (
  "id" SERIAL PRIMARY KEY,
  "company_id" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "customer_id" INTEGER REFERENCES "customers"("id") ON DELETE SET NULL,
  
  -- Customer Info (for new customers)
  "customer_first_name" VARCHAR(100) NOT NULL,
  "customer_last_name" VARCHAR(100) NOT NULL,
  "customer_email" VARCHAR(255) NOT NULL,
  "customer_phone" VARCHAR(50),
  
  -- Service Location
  "address" TEXT NOT NULL,
  "address_line_2" TEXT,
  "city" VARCHAR(100),
  "postcode" VARCHAR(50),
  "access_instructions" TEXT,
  
  -- Service Details
  "service_type" VARCHAR(100) NOT NULL,
  "property_type" VARCHAR(100),
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "square_footage" INTEGER,
  "has_special_requirements" SMALLINT DEFAULT 0,
  "special_requirements" TEXT,
  
  -- Scheduling
  "preferred_date" TIMESTAMP,
  "preferred_time_slot" VARCHAR(50),
  "alternate_date" TIMESTAMP,
  "frequency" VARCHAR(50) DEFAULT 'one_time',
  
  -- Pricing
  "estimated_price" DECIMAL(10, 2),
  "quoted_price" DECIMAL(10, 2),
  "currency" VARCHAR(10) DEFAULT 'GBP',
  
  -- Status & Processing
  "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "priority" VARCHAR(50) DEFAULT 'normal',
  
  -- Admin Notes
  "admin_notes" TEXT,
  "reviewed_by" INTEGER REFERENCES "users"("id"),
  "reviewed_at" TIMESTAMP,
  
  -- Conversion to Job
  "converted_to_job_id" INTEGER REFERENCES "jobs"("id"),
  "converted_at" TIMESTAMP,
  "converted_by" INTEGER REFERENCES "users"("id"),
  
  -- Source tracking
  "source" VARCHAR(100) DEFAULT 'website',
  "referral_code" VARCHAR(100),
  
  -- Timestamps
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "booking_requests_company_idx" ON "booking_requests"("company_id");
CREATE INDEX IF NOT EXISTS "booking_requests_customer_idx" ON "booking_requests"("customer_id");
CREATE INDEX IF NOT EXISTS "booking_requests_status_idx" ON "booking_requests"("status");
CREATE INDEX IF NOT EXISTS "booking_requests_email_idx" ON "booking_requests"("customer_email");
CREATE INDEX IF NOT EXISTS "booking_requests_date_idx" ON "booking_requests"("preferred_date");
