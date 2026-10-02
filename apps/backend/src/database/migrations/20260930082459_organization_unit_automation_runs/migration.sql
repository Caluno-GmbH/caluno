CREATE TABLE "organization_unit_automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"kind" "organization_unit_automation_kind" NOT NULL,
	"run_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_organization_unit_automation_runs_unit_kind_day" UNIQUE("organization_unit_id","kind","run_on")
);
--> statement-breakpoint
CREATE INDEX "idx_organization_unit_automation_runs_run_on" ON "organization_unit_automation_runs" ("run_on");--> statement-breakpoint
ALTER TABLE "organization_unit_automation_runs" ADD CONSTRAINT "organization_unit_automation_runs_DD6lKImvkn2C_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;