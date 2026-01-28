-- Add new columns to companies table
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "max_employees" integer DEFAULT 5;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "employee_rate" decimal(10, 2) DEFAULT '20.00';
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "monthly_plan_cost" decimal(10, 2) DEFAULT '0.00';

-- Create features table
CREATE TABLE IF NOT EXISTS "features" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"type" varchar(50) DEFAULT 'company' NOT NULL,
	"price" decimal(10, 2) DEFAULT '0.00' NOT NULL,
	"is_core" smallint DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create company_features junction table
CREATE TABLE IF NOT EXISTS "company_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"feature_id" integer NOT NULL,
	"is_enabled" smallint DEFAULT 1 NOT NULL,
	"enabled_at" timestamp DEFAULT now() NOT NULL,
	"disabled_at" timestamp
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "features_slug_idx" ON "features" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "features_type_idx" ON "features" USING btree ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "company_features_company_feature_idx" ON "company_features" USING btree ("company_id","feature_id");
CREATE INDEX IF NOT EXISTS "company_features_company_idx" ON "company_features" USING btree ("company_id");

-- Add foreign keys
DO $$ BEGIN
 ALTER TABLE "company_features" ADD CONSTRAINT "company_features_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "company_features" ADD CONSTRAINT "company_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Seed company features (£10-£100 range)
INSERT INTO "features" ("name", "slug", "description", "type", "price", "is_core", "sort_order") VALUES
('Dashboard & Overview', 'dashboard', 'Main dashboard with business overview and analytics', 'company', '0.00', 1, 1),
('Job Management', 'jobs', 'Create, assign, and track cleaning jobs', 'company', '0.00', 1, 2),
('Customer Management', 'customers', 'Manage customer profiles and contact information', 'company', '0.00', 1, 3),
('Basic Scheduling', 'scheduling-basic', 'Simple calendar and job scheduling', 'company', '0.00', 1, 4),
('Advanced Scheduling', 'scheduling-advanced', 'Recurring jobs, route optimization, and team scheduling', 'company', '25.00', 0, 5),
('Invoicing', 'invoicing', 'Create and send professional invoices', 'company', '15.00', 0, 6),
('Online Payments', 'payments', 'Accept card payments and track payment status', 'company', '25.00', 0, 7),
('Quotes & Estimates', 'quotes', 'Create and send quotes to potential customers', 'company', '15.00', 0, 8),
('Contracts', 'contracts', 'Digital contract management and e-signatures', 'company', '20.00', 0, 9),
('Cleaning Plans', 'cleaning-plans', 'Customizable cleaning checklists and task templates', 'company', '10.00', 0, 10),
('Photo Verification', 'photo-verification', 'Before/after photos for job verification', 'company', '15.00', 0, 11),
('Equipment Tracking', 'equipment', 'Track equipment inventory and maintenance', 'company', '10.00', 0, 12),
('Key Management', 'keys', 'Track customer keys and access codes', 'company', '10.00', 0, 13),
('Supply Management', 'supplies', 'Track cleaning supplies and reorder alerts', 'company', '10.00', 0, 14),
('Expense Tracking', 'expenses', 'Track business expenses and receipts', 'company', '15.00', 0, 15),
('Profitability Reports', 'profitability', 'Job profitability and margin analysis', 'company', '20.00', 0, 16),
('Service Areas', 'service-areas', 'Define and manage service coverage areas', 'company', '10.00', 0, 17),
('Booking Requests', 'booking-requests', 'Online booking form for new customers', 'company', '20.00', 0, 18),
('Customer Portal', 'customer-portal', 'Self-service portal for customers', 'company', '30.00', 0, 19),
('Messages & Communication', 'messages', 'Internal messaging and customer communication', 'company', '15.00', 0, 20),
('Subscriptions', 'subscriptions', 'Recurring service subscriptions and billing', 'company', '25.00', 0, 21),
('Custom Branding', 'branding', 'Custom logo, colors, and branding on documents', 'company', '20.00', 0, 22),
('API Access', 'api', 'API access for custom integrations', 'company', '50.00', 0, 23),
('Priority Support', 'priority-support', '24/7 priority customer support', 'company', '30.00', 0, 24)
ON CONFLICT (slug) DO NOTHING;

-- Seed employee features (£0-£10 range per employee)
INSERT INTO "features" ("name", "slug", "description", "type", "price", "is_core", "sort_order") VALUES
('Employee Profiles', 'employee-profiles', 'Basic employee profiles and contact info', 'employee', '0.00', 1, 100),
('Time Tracking', 'time-tracking', 'Clock in/out and work hours tracking', 'employee', '0.00', 1, 101),
('Job Board Access', 'job-board', 'Employee view of assigned jobs', 'employee', '0.00', 1, 102),
('Mobile Check-in', 'mobile-checkin', 'GPS check-in/out from mobile devices', 'employee', '3.00', 0, 103),
('Shift Management', 'shifts', 'Create and manage employee shifts', 'employee', '4.00', 0, 104),
('Shift Swapping', 'shift-swap', 'Allow employees to request shift swaps', 'employee', '2.00', 0, 105),
('Time Off Requests', 'time-off', 'Employee time off and vacation requests', 'employee', '3.00', 0, 106),
('Payroll Integration', 'payroll', 'Calculate wages and export payroll data', 'employee', '5.00', 0, 107),
('Employee Messaging', 'employee-messaging', 'Direct messaging between team members', 'employee', '2.00', 0, 108),
('Performance Tracking', 'performance', 'Track employee ratings and feedback', 'employee', '4.00', 0, 109)
ON CONFLICT (slug) DO NOTHING;
