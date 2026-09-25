ALTER TABLE "invoices" ADD COLUMN "hourly_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_number" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_number_seq" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_number_year" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_number_scope_unit_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoices_document_number" ON "invoices" ("document_number_scope_unit_id","document_number") WHERE "document_number_scope_unit_id" IS NOT NULL AND "document_number" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_0LOqhunmR5LM_fkey" FOREIGN KEY ("document_number_scope_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;