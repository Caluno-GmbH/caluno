CREATE TYPE "organization_unit_automation_kind" AS ENUM('PAUSE_APPROVAL', 'URGENT_CALL', 'DISCOVERY_EMAIL');--> statement-breakpoint
CREATE TYPE "weekday" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');--> statement-breakpoint
CREATE TABLE "organization_unit_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"kind" "organization_unit_automation_kind" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"active_days" "weekday"[] DEFAULT ARRAY[]::"weekday"[] NOT NULL,
	"lead_time_hours" smallint,
	"send_at_time" time,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_organization_unit_automations_unit_id_kind" UNIQUE("organization_unit_id","kind"),
	CONSTRAINT "chk_organization_unit_automations_lead_time_hours" CHECK ("lead_time_hours" IS NULL OR "lead_time_hours" IN (12, 24, 48, 72))
);
--> statement-breakpoint
CREATE INDEX "idx_organization_unit_automations_unit_id" ON "organization_unit_automations" ("organization_unit_id");--> statement-breakpoint
ALTER TABLE "organization_unit_automations" ADD CONSTRAINT "organization_unit_automations_SR8vBycElpMS_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;