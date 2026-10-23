CREATE TYPE "time_entry_closure_kind" AS ENUM('MANUAL', 'AUTO');--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "closure_kind" "time_entry_closure_kind";
--> statement-breakpoint
UPDATE "time_entries" SET "closure_kind" = 'MANUAL' WHERE "ended_at" IS NOT NULL;
