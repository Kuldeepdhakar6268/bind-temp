ALTER TABLE "contracts" ADD COLUMN "plan_id" integer;
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_plan_id_cleaning_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."cleaning_plans"("id") ON DELETE set null ON UPDATE no action;
