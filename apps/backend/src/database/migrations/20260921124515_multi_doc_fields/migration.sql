ALTER TABLE "form_block_fields" DROP CONSTRAINT "form_block_fields_document_file_id_files_id_fkey";--> statement-breakpoint
ALTER TABLE "form_block_fields" ADD COLUMN "document_file_ids" uuid[];--> statement-breakpoint
UPDATE "form_block_fields" SET "document_file_ids" = ARRAY["document_file_id"] WHERE "document_file_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "form_block_fields" DROP COLUMN "document_file_id";