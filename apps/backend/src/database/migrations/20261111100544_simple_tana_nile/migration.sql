CREATE TYPE "export_table" AS ENUM('TIMESHEETS', 'USERS', 'SHIFTS');--> statement-breakpoint
CREATE TABLE "export_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"actor_user_id" text,
	"table_kind" "export_table" NOT NULL,
	"columns" text[] NOT NULL,
	"included_technical_ids" boolean NOT NULL,
	"row_count" integer NOT NULL,
	"subject_user_ids" text[] NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_export_logs_organization_unit_id_occurred_at" ON "export_logs" ("organization_unit_id","occurred_at");--> statement-breakpoint
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;