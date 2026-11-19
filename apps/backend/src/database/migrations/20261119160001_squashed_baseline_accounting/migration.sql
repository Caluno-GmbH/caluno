-- Squashed baseline (part 2 of 2): accounting / contracts / invoices / reimbursements and todo_fill_filters.
-- Every statement is guarded so it is a no-op on a database that already has the schema.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'bundle_delivery_method'
  ) THEN
    CREATE TYPE "bundle_delivery_method" AS ENUM('DOWNLOAD', 'EMAIL');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'contract_status'
  ) THEN
    CREATE TYPE "contract_status" AS ENUM('DRAFT', 'AWAITING_VOLUNTEER_SIGNATURE', 'AWAITING_NGO_SIGNATURE', 'ACTIVE', 'EXPIRED', 'DECLINED');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'document_status_change'
  ) THEN
    CREATE TYPE "document_status_change" AS ENUM('CREATED', 'SIGNED', 'COUNTERSIGNED', 'ACTIVATED', 'DECLINED', 'EXPIRED', 'DRAFT_SUPERSEDED');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'document_kind'
  ) THEN
    CREATE TYPE "document_kind" AS ENUM('CONTRACT', 'INVOICE');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'renewal_cadence'
  ) THEN
    CREATE TYPE "renewal_cadence" AS ENUM('YEARLY', 'MONTHLY');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'invoice_status'
  ) THEN
    CREATE TYPE "invoice_status" AS ENUM('AWAITING_VOLUNTEER_SIGNATURE', 'AWAITING_SUPERVISOR_SIGNATURE', 'READY', 'DECLINED');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'bundle_delivery_issue'
  ) THEN
    CREATE TYPE "bundle_delivery_issue" AS ENUM('NO_CONTRACT', 'OVER_LIMIT', 'ALREADY_SENT');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'signee_type'
  ) THEN
    CREATE TYPE "signee_type" AS ENUM('VOLUNTEER', 'PERMISSION_HOLDER');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_delivery_settings" (
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
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_template_id" uuid NOT NULL,
	"volunteer_id" text NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key" NOT NULL,
	"contract_status" "contract_status" NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"renew_date" timestamp,
	"is_non_compliant" boolean DEFAULT false NOT NULL,
	"resolved_body" jsonb NOT NULL,
	"decline_reason" text,
	"declined_by_user_id" text,
	"declined_at" timestamp,
	"declined_at_signee_type" "signee_type",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"file_id" uuid,
	"organization_unit_id" uuid NOT NULL,
	"field_overrides" jsonb DEFAULT '{}' NOT NULL,
	"render_inputs" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"contract_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"signee_type" "signee_type" NOT NULL,
	"required_permission_id" uuid,
	"signed_by_user_id" text,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"signed_by_name" text,
	CONSTRAINT "chk_contract_signatures_required_permission_matches_signee_type" CHECK (("signee_type" = 'PERMISSION_HOLDER' AND "required_permission_id" IS NOT NULL) OR ("signee_type" = 'VOLUNTEER' AND "required_permission_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_status_changes" (
	"id" uuid CONSTRAINT "contract_events_pkey" PRIMARY KEY DEFAULT gen_random_uuid(),
	"contract_id" uuid NOT NULL,
	"type" "document_status_change" NOT NULL,
	"actor_user_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key" NOT NULL,
	"kind" "document_kind" NOT NULL,
	"renewal_cadence" "renewal_cadence",
	"invoice_number_format" text,
	"body" jsonb NOT NULL,
	"last_edited_at" timestamp,
	"last_edited_by" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_unit_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_template_id" uuid NOT NULL,
	"volunteer_id" text NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key" NOT NULL,
	"invoice_status" "invoice_status" NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"total_hours" numeric(10,2) NOT NULL,
	"is_non_compliant" boolean DEFAULT false NOT NULL,
	"resolved_body" jsonb NOT NULL,
	"decline_reason" text,
	"declined_by_user_id" text,
	"declined_at" timestamp,
	"declined_at_signee_type" "signee_type",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"file_id" uuid,
	"paid_at" timestamp,
	"paid_by_user_id" text,
	"organization_unit_id" uuid NOT NULL,
	"field_overrides" jsonb DEFAULT '{}' NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"document_number" text NOT NULL,
	"document_number_seq" integer NOT NULL,
	"document_number_year" integer NOT NULL,
	"document_number_scope_unit_id" uuid NOT NULL,
	"render_inputs" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"signee_type" "signee_type" NOT NULL,
	"required_permission_id" uuid,
	"signed_by_user_id" text,
	"signed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"signed_by_name" text,
	CONSTRAINT "chk_invoice_signatures_required_permission_matches_signee_type" CHECK (("signee_type" = 'PERMISSION_HOLDER' AND "required_permission_id" IS NOT NULL) OR ("signee_type" = 'VOLUNTEER' AND "required_permission_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_status_changes" (
	"id" uuid CONSTRAINT "invoice_events_pkey" PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"type" "document_status_change" NOT NULL,
	"actor_user_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invoice_id" uuid NOT NULL,
	"time_entry_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"released" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_bundle_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"volunteer_id" text NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key" NOT NULL,
	"method" "bundle_delivery_method" NOT NULL,
	"invoice_ids" uuid[] NOT NULL,
	"recipient_email" text,
	"subject" text,
	"issues" "bundle_delivery_issue"[] DEFAULT '{}'::"bundle_delivery_issue"[] NOT NULL,
	"email_outbox_id" uuid,
	"delivered_by_user_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"email_status" "email_delivery_status"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_bundle_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"volunteer_id" text NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key" NOT NULL,
	"downloaded_at" timestamp NOT NULL,
	"downloaded_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_manual_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"volunteer_id" text NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key" NOT NULL,
	"year" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key" NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_unit_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_types" (
	"key" "reimbursement_type_key" PRIMARY KEY,
	"legal_reference" text NOT NULL,
	"yearly_limit_cents" integer NOT NULL,
	"platform_default_rate_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_signees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"document_template_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"signee_type" "signee_type" NOT NULL,
	"required_permission_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_template_signees_required_permission_matches_signee_type" CHECK (("signee_type" = 'PERMISSION_HOLDER' AND "required_permission_id" IS NOT NULL) OR ("signee_type" = 'VOLUNTEER' AND "required_permission_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "todo_fill_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	"threshold" text DEFAULT 'BELOW_MINIMUM' NOT NULL,
	"days_ahead" integer DEFAULT 14 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "todo_fill_filters_user_id_organization_unit_id_unique" UNIQUE("user_id","organization_unit_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_accounting_delivery_settings_unit" ON "accounting_delivery_settings" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contracts_volunteer_type_unit" ON "contracts" ("volunteer_id","reimbursement_type_key","organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contract_status_changes_contract_id" ON "contract_status_changes" ("contract_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_document_templates_org_default" ON "document_templates" ("organization_id","reimbursement_type_key","kind") WHERE "organization_unit_id" IS NULL AND "is_deleted" = false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_document_templates_unit_override" ON "document_templates" ("organization_unit_id","reimbursement_type_key","kind") WHERE "organization_unit_id" IS NOT NULL AND "is_deleted" = false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoices_document_number" ON "invoices" ("document_number_scope_unit_id","document_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_status_changes_invoice_id" ON "invoice_status_changes" ("invoice_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoice_time_entries_time_entry_id" ON "invoice_time_entries" ("time_entry_id") WHERE "released" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reimbursement_bundle_deliveries_unit_occurred_at" ON "reimbursement_bundle_deliveries" ("organization_unit_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reimbursement_bundle_deliveries_invoice_ids" ON "reimbursement_bundle_deliveries" USING gin ("invoice_ids");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reimbursement_bundle_downloads_volunteer_type" ON "reimbursement_bundle_downloads" ("volunteer_id","reimbursement_type_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reimbursement_manual_baselines_org_volunteer_type_year" ON "reimbursement_manual_baselines" ("organization_id","volunteer_id","reimbursement_type_key","year");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reimbursement_rates_org_default" ON "reimbursement_rates" ("organization_id","reimbursement_type_key") WHERE "organization_unit_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reimbursement_rates_unit_override" ON "reimbursement_rates" ("organization_unit_id","reimbursement_type_key") WHERE "organization_unit_id" IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_delivery_settings_2WOvyvZM8A2f_fkey' AND conrelid = to_regclass('public."accounting_delivery_settings"')
  ) THEN
    ALTER TABLE "accounting_delivery_settings" ADD CONSTRAINT "accounting_delivery_settings_2WOvyvZM8A2f_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_delivery_settings_dVY1U9wsn2zb_fkey' AND conrelid = to_regclass('public."accounting_delivery_settings"')
  ) THEN
    ALTER TABLE "accounting_delivery_settings" ADD CONSTRAINT "accounting_delivery_settings_dVY1U9wsn2zb_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_delivery_settings_updated_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."accounting_delivery_settings"')
  ) THEN
    ALTER TABLE "accounting_delivery_settings" ADD CONSTRAINT "accounting_delivery_settings_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_document_template_id_document_templates_id_fkey' AND conrelid = to_regclass('public."contracts"')
  ) THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_document_template_id_document_templates_id_fkey" FOREIGN KEY ("document_template_id") REFERENCES "document_templates"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_volunteer_id_users_id_fkey' AND conrelid = to_regclass('public."contracts"')
  ) THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_volunteer_id_users_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_reimbursement_type_key_reimbursement_types_key_fkey' AND conrelid = to_regclass('public."contracts"')
  ) THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_reimbursement_type_key_reimbursement_types_key_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."contracts"')
  ) THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_file_id_files_id_fkey' AND conrelid = to_regclass('public."contracts"')
  ) THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contracts_declined_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."contracts"')
  ) THEN
    ALTER TABLE "contracts" ADD CONSTRAINT "contracts_declined_by_user_id_users_id_fkey" FOREIGN KEY ("declined_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_signatures_contract_id_contracts_id_fkey' AND conrelid = to_regclass('public."contract_signatures"')
  ) THEN
    ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_contract_id_contracts_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_signatures_required_permission_id_permissions_id_fkey' AND conrelid = to_regclass('public."contract_signatures"')
  ) THEN
    ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_required_permission_id_permissions_id_fkey" FOREIGN KEY ("required_permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_signatures_signed_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."contract_signatures"')
  ) THEN
    ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_signed_by_user_id_users_id_fkey" FOREIGN KEY ("signed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_events_contract_id_contracts_id_fkey' AND conrelid = to_regclass('public."contract_status_changes"')
  ) THEN
    ALTER TABLE "contract_status_changes" ADD CONSTRAINT "contract_events_contract_id_contracts_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_events_actor_user_id_users_id_fkey' AND conrelid = to_regclass('public."contract_status_changes"')
  ) THEN
    ALTER TABLE "contract_status_changes" ADD CONSTRAINT "contract_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_templates_organization_id_organizations_id_fkey' AND conrelid = to_regclass('public."document_templates"')
  ) THEN
    ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_templates_uuFF8AwlphzS_fkey' AND conrelid = to_regclass('public."document_templates"')
  ) THEN
    ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_uuFF8AwlphzS_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_templates_u5qLU2xFXFt0_fkey' AND conrelid = to_regclass('public."document_templates"')
  ) THEN
    ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_u5qLU2xFXFt0_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_templates_last_edited_by_users_id_fkey' AND conrelid = to_regclass('public."document_templates"')
  ) THEN
    ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_last_edited_by_users_id_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_document_template_id_document_templates_id_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_template_id_document_templates_id_fkey" FOREIGN KEY ("document_template_id") REFERENCES "document_templates"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_volunteer_id_users_id_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_volunteer_id_users_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_reimbursement_type_key_reimbursement_types_key_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reimbursement_type_key_reimbursement_types_key_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_file_id_files_id_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_declined_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_declined_by_user_id_users_id_fkey" FOREIGN KEY ("declined_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_paid_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paid_by_user_id_users_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_0LOqhunmR5LM_fkey' AND conrelid = to_regclass('public."invoices"')
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_0LOqhunmR5LM_fkey" FOREIGN KEY ("document_number_scope_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_signatures_invoice_id_invoices_id_fkey' AND conrelid = to_regclass('public."invoice_signatures"')
  ) THEN
    ALTER TABLE "invoice_signatures" ADD CONSTRAINT "invoice_signatures_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_signatures_required_permission_id_permissions_id_fkey' AND conrelid = to_regclass('public."invoice_signatures"')
  ) THEN
    ALTER TABLE "invoice_signatures" ADD CONSTRAINT "invoice_signatures_required_permission_id_permissions_id_fkey" FOREIGN KEY ("required_permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_signatures_signed_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."invoice_signatures"')
  ) THEN
    ALTER TABLE "invoice_signatures" ADD CONSTRAINT "invoice_signatures_signed_by_user_id_users_id_fkey" FOREIGN KEY ("signed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_events_invoice_id_invoices_id_fkey' AND conrelid = to_regclass('public."invoice_status_changes"')
  ) THEN
    ALTER TABLE "invoice_status_changes" ADD CONSTRAINT "invoice_events_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_events_actor_user_id_users_id_fkey' AND conrelid = to_regclass('public."invoice_status_changes"')
  ) THEN
    ALTER TABLE "invoice_status_changes" ADD CONSTRAINT "invoice_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_time_entries_invoice_id_invoices_id_fkey' AND conrelid = to_regclass('public."invoice_time_entries"')
  ) THEN
    ALTER TABLE "invoice_time_entries" ADD CONSTRAINT "invoice_time_entries_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_time_entries_time_entry_id_time_entries_id_fkey' AND conrelid = to_regclass('public."invoice_time_entries"')
  ) THEN
    ALTER TABLE "invoice_time_entries" ADD CONSTRAINT "invoice_time_entries_time_entry_id_time_entries_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "time_entries"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_deliveries_7U3XBinZqlyF_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_deliveries"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_7U3XBinZqlyF_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_deliveries_volunteer_id_users_id_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_deliveries"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_volunteer_id_users_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_deliveries_iQ5y6EOj6Mfl_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_deliveries"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_iQ5y6EOj6Mfl_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_deliveries_jZXO2ad08wW6_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_deliveries"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_jZXO2ad08wW6_fkey" FOREIGN KEY ("email_outbox_id") REFERENCES "email_outbox"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_deliveries_NQdqYzSta6JO_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_deliveries"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_deliveries" ADD CONSTRAINT "reimbursement_bundle_deliveries_NQdqYzSta6JO_fkey" FOREIGN KEY ("delivered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_downloads_volunteer_id_users_id_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_downloads"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_downloads" ADD CONSTRAINT "reimbursement_bundle_downloads_volunteer_id_users_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_downloads_hZvBXBun6Y0y_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_downloads"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_downloads" ADD CONSTRAINT "reimbursement_bundle_downloads_hZvBXBun6Y0y_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_bundle_downloads_UssWxAIn1SKo_fkey' AND conrelid = to_regclass('public."reimbursement_bundle_downloads"')
  ) THEN
    ALTER TABLE "reimbursement_bundle_downloads" ADD CONSTRAINT "reimbursement_bundle_downloads_UssWxAIn1SKo_fkey" FOREIGN KEY ("downloaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_manual_baselines_2FUj42rkzJU1_fkey' AND conrelid = to_regclass('public."reimbursement_manual_baselines"')
  ) THEN
    ALTER TABLE "reimbursement_manual_baselines" ADD CONSTRAINT "reimbursement_manual_baselines_2FUj42rkzJU1_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_manual_baselines_volunteer_id_users_id_fkey' AND conrelid = to_regclass('public."reimbursement_manual_baselines"')
  ) THEN
    ALTER TABLE "reimbursement_manual_baselines" ADD CONSTRAINT "reimbursement_manual_baselines_volunteer_id_users_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_manual_baselines_FloNSSx07KP3_fkey' AND conrelid = to_regclass('public."reimbursement_manual_baselines"')
  ) THEN
    ALTER TABLE "reimbursement_manual_baselines" ADD CONSTRAINT "reimbursement_manual_baselines_FloNSSx07KP3_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_manual_baselines_updated_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."reimbursement_manual_baselines"')
  ) THEN
    ALTER TABLE "reimbursement_manual_baselines" ADD CONSTRAINT "reimbursement_manual_baselines_updated_by_user_id_users_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_rates_organization_id_organizations_id_fkey' AND conrelid = to_regclass('public."reimbursement_rates"')
  ) THEN
    ALTER TABLE "reimbursement_rates" ADD CONSTRAINT "reimbursement_rates_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_rates_iwVFHWflZGEn_fkey' AND conrelid = to_regclass('public."reimbursement_rates"')
  ) THEN
    ALTER TABLE "reimbursement_rates" ADD CONSTRAINT "reimbursement_rates_iwVFHWflZGEn_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reimbursement_rates_WXcsgTnVo6Md_fkey' AND conrelid = to_regclass('public."reimbursement_rates"')
  ) THEN
    ALTER TABLE "reimbursement_rates" ADD CONSTRAINT "reimbursement_rates_WXcsgTnVo6Md_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'template_signees_4VK8PQ5EFhiQ_fkey' AND conrelid = to_regclass('public."template_signees"')
  ) THEN
    ALTER TABLE "template_signees" ADD CONSTRAINT "template_signees_4VK8PQ5EFhiQ_fkey" FOREIGN KEY ("document_template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'template_signees_required_permission_id_permissions_id_fkey' AND conrelid = to_regclass('public."template_signees"')
  ) THEN
    ALTER TABLE "template_signees" ADD CONSTRAINT "template_signees_required_permission_id_permissions_id_fkey" FOREIGN KEY ("required_permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_reimbursement_type_key_reimbursement_types_key_fkey' AND conrelid = to_regclass('public."shifts"')
  ) THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_reimbursement_type_key_reimbursement_types_key_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_instances_iSRIYnk56k4h_fkey' AND conrelid = to_regclass('public."shift_instances"')
  ) THEN
    ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_iSRIYnk56k4h_fkey" FOREIGN KEY ("override_reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'todo_fill_filters_user_id_users_id_fkey' AND conrelid = to_regclass('public."todo_fill_filters"')
  ) THEN
    ALTER TABLE "todo_fill_filters" ADD CONSTRAINT "todo_fill_filters_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'todo_fill_filters_fDZ5fe6oxg0X_fkey' AND conrelid = to_regclass('public."todo_fill_filters"')
  ) THEN
    ALTER TABLE "todo_fill_filters" ADD CONSTRAINT "todo_fill_filters_fDZ5fe6oxg0X_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'time_entries_4MweV9u9xVMF_fkey' AND conrelid = to_regclass('public."time_entries"')
  ) THEN
    ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_4MweV9u9xVMF_fkey" FOREIGN KEY ("reimbursement_type_key") REFERENCES "reimbursement_types"("key") ON DELETE RESTRICT;
  END IF;
END $$;
