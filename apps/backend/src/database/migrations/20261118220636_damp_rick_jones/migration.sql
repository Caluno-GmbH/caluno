ALTER TABLE "contracts" DROP CONSTRAINT "contracts_reimbursement_type_id_reimbursement_types_id_fkey";--> statement-breakpoint
ALTER TABLE "document_templates" DROP CONSTRAINT "document_templates_dBOb81rs3ftQ_fkey";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_reimbursement_type_id_reimbursement_types_id_fkey";--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" DROP CONSTRAINT "reimbursement_bundle_deliveries_6VhCMas4r3gf_fkey";--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_downloads" DROP CONSTRAINT "reimbursement_bundle_downloads_wYr9Yo32WOYe_fkey";--> statement-breakpoint
ALTER TABLE "reimbursement_manual_baselines" DROP CONSTRAINT "reimbursement_manual_baselines_UkklTF5FXBMJ_fkey";--> statement-breakpoint
ALTER TABLE "reimbursement_rates" DROP CONSTRAINT "reimbursement_rates_RDd1dX429TuF_fkey";--> statement-breakpoint
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_reimbursement_type_id_reimbursement_types_id_fkey";--> statement-breakpoint
ALTER TABLE "shift_instances" DROP CONSTRAINT "shift_instances_vqbeHnPUINmZ_fkey";--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_reimbursement_type_id_reimbursement_types_id_fkey";--> statement-breakpoint
ALTER TABLE "contracts" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "document_templates" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "invoices" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_downloads" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "reimbursement_manual_baselines" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "reimbursement_rates" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "shifts" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "shift_instances" RENAME COLUMN "override_reimbursement_type_id" TO "override_reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "time_entries" RENAME COLUMN "reimbursement_type_id" TO "reimbursement_type_key";--> statement-breakpoint
ALTER TABLE "reimbursement_types" DROP CONSTRAINT "uq_reimbursement_types_key";--> statement-breakpoint
ALTER INDEX "idx_shifts_reimbursement_type_id" RENAME TO "idx_shifts_reimbursement_type_key";--> statement-breakpoint
CREATE FUNCTION "__reimbursement_type_key_by_id"(type_id uuid) RETURNS "reimbursement_type_key" LANGUAGE sql STABLE AS $$ SELECT "key" FROM "reimbursement_types" WHERE "id" = type_id $$;--> statement-breakpoint
ALTER TABLE "contracts" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "document_templates" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "reimbursement_rates" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_downloads" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "reimbursement_manual_baselines" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "shifts" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "shift_instances" ALTER COLUMN "override_reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("override_reimbursement_type_key");--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" ALTER COLUMN "reimbursement_type_key" SET DATA TYPE "reimbursement_type_key" USING "__reimbursement_type_key_by_id"("reimbursement_type_key");--> statement-breakpoint
DROP FUNCTION "__reimbursement_type_key_by_id"(uuid);--> statement-breakpoint
ALTER TABLE "reimbursement_types" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "reimbursement_types" ADD PRIMARY KEY ("key");--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_reimbursement_type_key_reimbursement_types_key_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_u5qLU2xFXFt0_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reimbursement_type_key_reimbursement_types_key_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_iQ5y6EOj6Mfl_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_downloads" ADD CONSTRAINT "reimbursement_bundle_downloads_hZvBXBun6Y0y_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reimbursement_manual_baselines" ADD CONSTRAINT "reimbursement_manual_baselines_FloNSSx07KP3_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reimbursement_rates" ADD CONSTRAINT "reimbursement_rates_WXcsgTnVo6Md_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_reimbursement_type_key_reimbursement_types_key_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_iSRIYnk56k4h_fkey" FOREIGN KEY ("override_reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_4MweV9u9xVMF_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "chk_time_entries_paid_requires_reimbursement_type", ADD CONSTRAINT "chk_time_entries_paid_requires_reimbursement_type" CHECK ("is_paid" = false OR "reimbursement_type_key" IS NOT NULL);
