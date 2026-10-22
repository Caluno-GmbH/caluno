ALTER TABLE "form_submission_values" DROP CONSTRAINT "form_submission_values_block_id_form_blocks_id_fkey";--> statement-breakpoint
DROP INDEX "idx_form_submission_values_block_id";--> statement-breakpoint
ALTER TABLE "form_submission_values" DROP COLUMN "block_id";