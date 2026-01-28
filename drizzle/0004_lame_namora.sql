CREATE TABLE "supplies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"sku" varchar(100),
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" varchar(50),
	"min_quantity" integer DEFAULT 5,
	"unit_cost" numeric(12, 2),
	"supplier" varchar(255),
	"status" varchar(50) DEFAULT 'in-stock' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplies_company_idx" ON "supplies" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "supplies_category_idx" ON "supplies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "supplies_status_idx" ON "supplies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplies_sku_idx" ON "supplies" USING btree ("sku");