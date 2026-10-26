-- InvoiceStatus.DRAFT is removed: timesheets are never auto-drafted.
-- Delete any leftover DRAFT rows before rewriting the enum (claims, signature
-- slots and status history cascade; time entries become available again).
DELETE FROM "invoices"
WHERE "invoice_status" = 'DRAFT';
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "invoice_status";--> statement-breakpoint
CREATE TYPE "invoice_status" AS ENUM('AWAITING_VOLUNTEER_SIGNATURE', 'AWAITING_SUPERVISOR_SIGNATURE', 'READY', 'DECLINED');--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_status" SET DATA TYPE "invoice_status" USING "invoice_status"::"invoice_status";
