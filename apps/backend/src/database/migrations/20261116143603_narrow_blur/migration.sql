CREATE TYPE "bundle_delivery_method" AS ENUM('DOWNLOAD', 'EMAIL');--> statement-breakpoint
CREATE TYPE "bundle_delivery_issue" AS ENUM('NO_CONTRACT', 'OVER_LIMIT', 'ALREADY_SENT');--> statement-breakpoint
ALTER TYPE "email_category" ADD VALUE 'ACCOUNTING_BUNDLE';--> statement-breakpoint
CREATE TABLE "accounting_delivery_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	"delivery_method" "bundle_delivery_method",
	"recipient_email" text,
	"email_subject" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reimbursement_bundle_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"volunteer_id" text NOT NULL,
	"reimbursement_type_id" uuid NOT NULL,
	"method" "bundle_delivery_method" NOT NULL,
	"invoice_ids" uuid[] NOT NULL,
	"recipient_email" text,
	"subject" text,
	"issues" "bundle_delivery_issue"[] DEFAULT '{}'::"bundle_delivery_issue"[] NOT NULL,
	"email_outbox_id" uuid,
	"delivered_by_user_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounting_delivery_settings_unit" ON "accounting_delivery_settings" ("organization_unit_id");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bundle_deliveries_unit_occurred_at" ON "reimbursement_bundle_deliveries" ("organization_unit_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_reimbursement_bundle_deliveries_invoice_ids" ON "reimbursement_bundle_deliveries" USING gin ("invoice_ids");--> statement-breakpoint
ALTER TABLE "accounting_delivery_settings" ADD CONSTRAINT "accounting_delivery_settings_2WOvyvZM8A2f_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "accounting_delivery_settings" ADD CONSTRAINT "accounting_delivery_settings_dVY1U9wsn2zb_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "accounting_delivery_settings" ADD CONSTRAINT "accounting_delivery_settings_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_7U3XBinZqlyF_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_volunteer_id_users_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_6VhCMas4r3gf_fkey" FOREIGN KEY ("reimbursement_type_id") REFERENCES "reimbursement_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_jZXO2ad08wW6_fkey" FOREIGN KEY ("email_outbox_id") REFERENCES "email_outbox"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_NQdqYzSta6JO_fkey" FOREIGN KEY ("delivered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;