CREATE TABLE "customer_feedback" (
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
--> statement-breakpoint
CREATE TABLE "event_logs" (
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
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"user_id" integer,
	"employee_id" integer,
	"company_id" integer,
	"type" varchar(20) DEFAULT 'user' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "feedback_token" varchar(255);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "access_token" varchar(255);--> statement-breakpoint
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_feedback_company_idx" ON "customer_feedback" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "customer_feedback_customer_idx" ON "customer_feedback" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_feedback_job_idx" ON "customer_feedback" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "customer_feedback_token_idx" ON "customer_feedback" USING btree ("feedback_token");--> statement-breakpoint
CREATE INDEX "event_logs_company_idx" ON "event_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "event_logs_event_type_idx" ON "event_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "event_logs_entity_idx" ON "event_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "event_logs_created_idx" ON "event_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_employee_idx" ON "sessions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "jobs_feedback_token_idx" ON "jobs" USING btree ("feedback_token");--> statement-breakpoint
CREATE INDEX "quotes_access_token_idx" ON "quotes" USING btree ("access_token");