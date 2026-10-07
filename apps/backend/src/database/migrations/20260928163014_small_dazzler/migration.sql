ALTER TABLE "time_entries" ADD COLUMN "created_by_id" text;--> statement-breakpoint
CREATE INDEX "idx_time_entries_created_by_id" ON "time_entries" ("created_by_id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;