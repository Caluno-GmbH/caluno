-- Squashed baseline of all previous core migrations (part 1 of 2: everything except the accounting/contracts tables).
-- Every statement is guarded so it is a no-op on a database that already has the schema.

-- Needed by core columns (shifts, time_entries); repeated in part 2 as a guarded no-op.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'reimbursement_type_key'
  ) THEN
    CREATE TYPE "reimbursement_type_key" AS ENUM('EHRENAMT', 'UEBUNGSLEITER');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'event_invite_status'
  ) THEN
    CREATE TYPE "event_invite_status" AS ENUM('ADMIN_INVITED', 'AWAITING_ADMIN_APPROVAL', 'WAITLIST_JOINED', 'JOINED', 'VOLUNTEER_REJECTED', 'VOLUNTEER_CANCELLED', 'ADMIN_REJECTED');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'export_table'
  ) THEN
    CREATE TYPE "export_table" AS ENUM('TIMESHEETS', 'USERS', 'SHIFTS');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'membership_request_status'
  ) THEN
    CREATE TYPE "membership_request_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'email_category'
  ) THEN
    CREATE TYPE "email_category" AS ENUM('CALL_OUT', 'CALL_OUT_NO_RECIPIENTS', 'MANAGER_NOTIFICATION', 'DIGEST', 'INVITE_REMINDER', 'NOTIFICATION', 'AUTH', 'SUPPORT', 'ACCOUNTING_BUNDLE');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'email_delivery_status'
  ) THEN
    CREATE TYPE "email_delivery_status" AS ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'organization_unit_automation_kind'
  ) THEN
    CREATE TYPE "organization_unit_automation_kind" AS ENUM('PAUSE_APPROVAL', 'URGENT_CALL', 'DISCOVERY_EMAIL');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'weekday'
  ) THEN
    CREATE TYPE "weekday" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'shift_visibility'
  ) THEN
    CREATE TYPE "shift_visibility" AS ENUM('INVITED_MEMBERS', 'ALL_MEMBERS');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'shift_call_out_source'
  ) THEN
    CREATE TYPE "shift_call_out_source" AS ENUM('MANUAL', 'AUTOMATIC');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'shift_invite_status'
  ) THEN
    CREATE TYPE "shift_invite_status" AS ENUM('ADMIN_INVITED', 'AWAITING_ADMIN_APPROVAL', 'WAITLIST_JOINED', 'JOINED', 'VOLUNTEER_REJECTED', 'VOLUNTEER_CANCELLED', 'ADMIN_REJECTED');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'shift_manager_notification_kind'
  ) THEN
    CREATE TYPE "shift_manager_notification_kind" AS ENUM('CALL_OUT_SUMMARY', 'REMINDER');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'file_purpose'
  ) THEN
    CREATE TYPE "file_purpose" AS ENUM('requirement_document', 'document', 'export', 'form_document', 'org_logo', 'organization_logo', 'event_image', 'shift_image', 'profile_picture');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'file_status'
  ) THEN
    CREATE TYPE "file_status" AS ENUM('pending', 'uploaded', 'failed');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'file_visibility'
  ) THEN
    CREATE TYPE "file_visibility" AS ENUM('private', 'public');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'terms_change_class'
  ) THEN
    CREATE TYPE "terms_change_class" AS ENUM('MINOR', 'MAJOR');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'time_entry_closure_kind'
  ) THEN
    CREATE TYPE "time_entry_closure_kind" AS ENUM('MANUAL', 'AUTO');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"check_in_id" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"locale" text,
	"privacy_policy_version" text,
	"privacy_policy_accepted_at" timestamp,
	"email_weekly_update_enabled" boolean DEFAULT true NOT NULL,
	"email_urgent_calls_enabled" boolean DEFAULT true NOT NULL,
	"email_platform_enabled" boolean DEFAULT true NOT NULL,
	"firstname" text NOT NULL,
	"lastname" text NOT NULL,
	"preferred_name" text,
	"gender" text,
	"phone" text,
	"street" text,
	"zip" text,
	"city" text,
	"birthdate" text,
	"iban" text,
	"account_holder" text,
	"bic" text,
	"terms_version" text,
	"terms_accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"key" text NOT NULL UNIQUE,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"description" text,
	"is_internal" boolean DEFAULT false NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_roles_name_organization_unit_id" UNIQUE("name","organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_role_permissions_role_id_permission_id" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"location" text,
	"logo_url" text,
	"cover_url" text,
	"organization_unit_id" uuid NOT NULL,
	"created_by_id" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"join_requires_approval" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "event_invite_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_event_invites_event_user" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_required_forms" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"form_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_event_required_forms" PRIMARY KEY("event_id","form_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "export_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"actor_user_id" text,
	"table_kind" "export_table" NOT NULL,
	"columns" text[] NOT NULL,
	"included_technical_ids" boolean NOT NULL,
	"row_count" integer NOT NULL,
	"subject_user_ids" text[] NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"included_sub_units" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"id_verified_at" timestamp,
	"id_verified_by_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"status" "membership_request_status" DEFAULT 'PENDING'::"membership_request_status" NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "uq_membership_requests_user_id_organization_unit_id" UNIQUE("user_id","organization_unit_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_membership_roles_membership_id_role_id" UNIQUE("membership_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"category" "email_category" NOT NULL,
	"user_id" text,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"html" text,
	"text_body" text,
	"attachments" jsonb,
	"organization_unit_id" uuid,
	"status" "email_delivery_status" DEFAULT 'PENDING'::"email_delivery_status" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_error" text,
	"provider_message_id" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo_url" text,
	"website_url" text,
	"contact_email" text,
	"phone" text,
	"description" text,
	"street" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"accounting_enabled" boolean DEFAULT false NOT NULL,
	"city" text,
	"zip_code" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_unit_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_organization_unit_invitations_user_id_organization_unit_id" UNIQUE("user_id","organization_unit_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"parent_id" uuid,
	"type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"logo_url" text,
	"website_url" text,
	"contact_email" text,
	"phone" text,
	"description" text,
	"street" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cover_url" text,
	"city" text,
	"zip_code" text,
	"legal_rep" text,
	"id_verification_enabled" boolean DEFAULT false NOT NULL,
	"contact_person_name" text,
	"welcome_message" text,
	CONSTRAINT "uq_organization_units_organization_id_slug" UNIQUE("organization_id","slug"),
	CONSTRAINT "uq_organization_units_organization_id_id" UNIQUE("organization_id","id"),
	CONSTRAINT "chk_organization_units_not_self_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_unit_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"kind" "organization_unit_automation_kind" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"active_days" "weekday"[] DEFAULT ARRAY[]::"weekday"[] NOT NULL,
	"lead_time_hours" smallint,
	"send_at_time" time,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_organization_unit_automations_unit_id_kind" UNIQUE("organization_unit_id","kind"),
	CONSTRAINT "chk_organization_unit_automations_lead_time_hours" CHECK ("lead_time_hours" IS NULL OR "lead_time_hours" IN (12, 24, 48, 72))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_unit_automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_unit_id" uuid NOT NULL,
	"kind" "organization_unit_automation_kind" NOT NULL,
	"run_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_organization_unit_automation_runs_unit_kind_day" UNIQUE("organization_unit_id","kind","run_on")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_unit_required_forms" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"organization_unit_id" uuid,
	"form_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_organization_unit_required_forms" PRIMARY KEY("organization_unit_id","form_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_unit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "uq_organization_unit_types_organization_id_name" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" text,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_form_blocks_organization_id_title" UNIQUE("organization_id","title")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_block_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"block_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"placeholder" text,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"lock_type" boolean DEFAULT false NOT NULL,
	"profile_key" text,
	"options" jsonb,
	"document_label" text,
	"min_age" integer,
	"field_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"document_file_ids" uuid[]
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	CONSTRAINT "uq_form_submissions_user_form_unit" UNIQUE("user_id","form_id","organization_unit_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_submission_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"submission_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_user_profile_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_user_profile_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_org_user_profile_field_values_profile_field" UNIQUE("organization_user_profile_id","field_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "requirement_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"share_token" text NOT NULL UNIQUE,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"organization_unit_id" uuid,
	CONSTRAINT "uq_requirement_forms_organization_unit_id_name" UNIQUE("organization_unit_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "requirement_form_block_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"form_id" uuid NOT NULL,
	"block_id" uuid NOT NULL,
	"field_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posthog_distinct_secrets" (
	"slot" text PRIMARY KEY,
	"secret" text NOT NULL,
	"valid_for_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"instructions" text,
	"organization_unit_id" uuid NOT NULL,
	"created_by_id" text NOT NULL,
	"location" text,
	"visibility" "shift_visibility" DEFAULT 'ALL_MEMBERS'::"shift_visibility" NOT NULL,
	"max_volunteers" integer,
	"rrule" text,
	"original_starts_at" timestamp NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"min_volunteers" integer,
	"event_id" uuid,
	"image_url" text,
	"reimbursement_type_key" "reimbursement_type_key",
	"join_requires_approval" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_call_out_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"instance_id" uuid NOT NULL,
	"recipient_id" text NOT NULL,
	"sent_by_id" text NOT NULL,
	"sent_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"source" "shift_call_out_source" DEFAULT 'MANUAL'::"shift_call_out_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"master_id" uuid NOT NULL,
	"actual_starts_at" timestamp NOT NULL,
	"actual_ends_at" timestamp NOT NULL,
	"override_title" text,
	"override_instructions" text,
	"override_location" text,
	"override_max_volunteers" integer,
	"is_exception" boolean DEFAULT false NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"occurrence_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_by_sync" boolean DEFAULT false NOT NULL,
	"override_min_volunteers" integer,
	"override_reimbursement_type_key" "reimbursement_type_key",
	"override_join_requires_approval" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instance_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"instance_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "shift_invite_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"reminded_at" timestamp,
	CONSTRAINT "uq_sii_instance_user" UNIQUE("instance_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instance_required_forms" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"shift_instance_id" uuid,
	"form_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_shift_instance_required_forms" PRIMARY KEY("shift_instance_id","form_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instance_understaffed_states" (
	"instance_id" uuid PRIMARY KEY,
	"last_checked_at" timestamp,
	"call_out_fired_at" timestamp,
	"reminder_fired_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"shift_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "shift_invite_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_shift_invites_shift_user" UNIQUE("shift_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_manager_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"instance_id" uuid NOT NULL,
	"recipient_id" text NOT NULL,
	"kind" "shift_manager_notification_kind" NOT NULL,
	"sent_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_required_forms" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid,
	"form_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_shift_required_forms" PRIMARY KEY("shift_id","form_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "volunteer_digest_shift_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"shift_id" uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"send_date" timestamp NOT NULL,
	"accepted_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"storage_key" text NOT NULL UNIQUE,
	"bucket" text NOT NULL,
	"visibility" "file_visibility" NOT NULL,
	"purpose" "file_purpose" NOT NULL,
	"mime_type" text NOT NULL,
	"filename" text NOT NULL,
	"byte_size" integer,
	"status" "file_status" DEFAULT 'pending'::"file_status" NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"organization_unit_id" uuid,
	"public_url" text,
	"uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	"class" "terms_change_class" NOT NULL,
	"language" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"document_filename" text NOT NULL,
	"document_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	"class" "terms_change_class" NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" text NOT NULL CONSTRAINT "terms_versions_version_key" UNIQUE,
	"class" "terms_change_class" NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"shift_instance_id" uuid,
	"volunteer_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"reimbursement_type_key" "reimbursement_type_key",
	"is_paid" boolean DEFAULT false NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	"created_by_id" text,
	"closure_kind" "time_entry_closure_kind",
	CONSTRAINT "chk_time_entries_paid_requires_reimbursement_type" CHECK ("is_paid" = false OR "reimbursement_type_key" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" ("identifier");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_permissions_key" ON "permissions" ("key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_roles_organization_id" ON "roles" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_org_unit_id" ON "events" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_created_by_id" ON "events" ("created_by_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_slug" ON "events" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_is_deleted" ON "events" ("is_deleted");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_invites_event_id" ON "event_invites" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_invites_user_id" ON "event_invites" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_invites_status" ON "event_invites" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_export_logs_organization_unit_id_occurred_at" ON "export_logs" ("organization_unit_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memberships_user_id" ON "memberships" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_memberships_organization_unit_id" ON "memberships" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_membership_requests_user_id" ON "membership_requests" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_membership_requests_organization_unit_id" ON "membership_requests" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_membership_roles_membership_id" ON "membership_roles" ("membership_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_membership_roles_role_id" ON "membership_roles" ("role_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_outbox_status_next_attempt" ON "email_outbox" ("status","next_attempt_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_outbox_organization_unit_created_at" ON "email_outbox" ("organization_unit_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_outbox_user_id" ON "email_outbox" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_outbox_provider_message_id" ON "email_outbox" ("provider_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizations_name" ON "organizations" ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizations_deleted_at" ON "organizations" ("deleted_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organization_units_organization_id_is_root_true" ON "organization_units" ("organization_id") WHERE "parent_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_units_parent_id" ON "organization_units" ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_units_type_id" ON "organization_units" ("type_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_units_name" ON "organization_units" ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_units_deleted_at" ON "organization_units" ("deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_unit_automations_unit_id" ON "organization_unit_automations" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_unit_automation_runs_run_on" ON "organization_unit_automation_runs" ("run_on");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_unit_types_organization_id" ON "organization_unit_types" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_unit_types_name" ON "organization_unit_types" ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_blocks_organization_id" ON "form_blocks" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_blocks_created_by" ON "form_blocks" ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_block_fields_block_id" ON "form_block_fields" ("block_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_block_fields_system_key" ON "form_block_fields" ("profile_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_submissions_form_id" ON "form_submissions" ("form_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_submissions_user_id" ON "form_submissions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_submissions_organization_unit_id" ON "form_submissions" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_submission_values_submission_id" ON "form_submission_values" ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_form_submission_values_field_id" ON "form_submission_values" ("field_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_user_profiles_organization_id" ON "organization_user_profiles" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_user_profiles_user_id" ON "organization_user_profiles" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_org_user_profile_field_values_profile_id" ON "organization_user_profile_field_values" ("organization_user_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_org_user_profile_field_values_field_id" ON "organization_user_profile_field_values" ("field_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_requirement_forms_organization_id" ON "requirement_forms" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_requirement_forms_organization_unit_id" ON "requirement_forms" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_requirement_forms_share_token" ON "requirement_forms" ("share_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_requirement_form_block_refs_form_id" ON "requirement_form_block_refs" ("form_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_requirement_form_block_refs_block_id" ON "requirement_form_block_refs" ("block_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shifts_org_unit_id" ON "shifts" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shifts_created_by_id" ON "shifts" ("created_by_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shifts_event_id" ON "shifts" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shifts_reimbursement_type_key" ON "shifts" ("reimbursement_type_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shifts_slug" ON "shifts" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shifts_is_deleted" ON "shifts" ("is_deleted");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scor_instance_id" ON "shift_call_out_recipients" ("instance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scor_recipient_id" ON "shift_call_out_recipients" ("recipient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scor_sent_by_id" ON "shift_call_out_recipients" ("sent_by_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scor_sent_at" ON "shift_call_out_recipients" ("sent_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_si_master_id" ON "shift_instances" ("master_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_si_actual_starts_at" ON "shift_instances" ("actual_starts_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_si_actual_ends_at" ON "shift_instances" ("actual_ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_si_active_range" ON "shift_instances" ("actual_starts_at","actual_ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_si_is_exception" ON "shift_instances" ("is_exception");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_si_is_cancelled" ON "shift_instances" ("is_cancelled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sii_instance_id" ON "shift_instance_invites" ("instance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sii_user_id" ON "shift_instance_invites" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sii_status" ON "shift_instance_invites" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shift_invites_shift_id" ON "shift_invites" ("shift_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shift_invites_user_id" ON "shift_invites" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_shift_invites_status" ON "shift_invites" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_smn_instance_id" ON "shift_manager_notifications" ("instance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_smn_recipient_id" ON "shift_manager_notifications" ("recipient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_smn_sent_at" ON "shift_manager_notifications" ("sent_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdsl_user_id" ON "volunteer_digest_shift_logs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdsl_instance_id" ON "volunteer_digest_shift_logs" ("instance_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdsl_send_date" ON "volunteer_digest_shift_logs" ("send_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_uploaded_by_user_id" ON "files" ("uploaded_by_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_organization_unit_id" ON "files" ("organization_unit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_status" ON "files" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_terms_acceptances_user_id" ON "terms_acceptances" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_terms_acceptances_user_id_accepted_at" ON "terms_acceptances" ("user_id","accepted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_terms_notifications_user_id" ON "terms_notifications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_time_entries_org_unit_started_at" ON "time_entries" ("organization_unit_id","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_time_entries_created_by_id" ON "time_entries" ("created_by_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_time_entries_open_per_instance_volunteer" ON "time_entries" ("shift_instance_id","volunteer_id") WHERE "ended_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_time_entries_open_shiftless_per_org_volunteer" ON "time_entries" ("organization_unit_id","volunteer_id") WHERE "shift_instance_id" IS NULL AND "ended_at" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_user_id_users_id_fkey' AND conrelid = to_regclass('public."accounts"')
  ) THEN
    ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_user_id_users_id_fkey' AND conrelid = to_regclass('public."sessions"')
  ) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_organization_id_organizations_id_fkey' AND conrelid = to_regclass('public."roles"')
  ) THEN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_role_id_roles_id_fkey' AND conrelid = to_regclass('public."role_permissions"')
  ) THEN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_permissions_permission_id_permissions_id_fkey' AND conrelid = to_regclass('public."role_permissions"')
  ) THEN
    ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."events"')
  ) THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_created_by_id_users_id_fkey' AND conrelid = to_regclass('public."events"')
  ) THEN
    ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_invites_event_id_events_id_fkey' AND conrelid = to_regclass('public."event_invites"')
  ) THEN
    ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_invites_user_id_users_id_fkey' AND conrelid = to_regclass('public."event_invites"')
  ) THEN
    ALTER TABLE "event_invites" ADD CONSTRAINT "event_invites_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_required_forms_event_id_events_id_fkey' AND conrelid = to_regclass('public."event_required_forms"')
  ) THEN
    ALTER TABLE "event_required_forms" ADD CONSTRAINT "event_required_forms_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_required_forms_form_id_requirement_forms_id_fkey' AND conrelid = to_regclass('public."event_required_forms"')
  ) THEN
    ALTER TABLE "event_required_forms" ADD CONSTRAINT "event_required_forms_form_id_requirement_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "requirement_forms"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'export_logs_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."export_logs"')
  ) THEN
    ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'export_logs_actor_user_id_users_id_fkey' AND conrelid = to_regclass('public."export_logs"')
  ) THEN
    ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'memberships_user_id_users_id_fkey' AND conrelid = to_regclass('public."memberships"')
  ) THEN
    ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'memberships_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."memberships"')
  ) THEN
    ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'memberships_id_verified_by_id_users_id_fkey' AND conrelid = to_regclass('public."memberships"')
  ) THEN
    ALTER TABLE "memberships" ADD CONSTRAINT "memberships_id_verified_by_id_users_id_fkey" FOREIGN KEY ("id_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_requests_user_id_users_id_fkey' AND conrelid = to_regclass('public."membership_requests"')
  ) THEN
    ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_requests_JnW42Hb2WNYu_fkey' AND conrelid = to_regclass('public."membership_requests"')
  ) THEN
    ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_JnW42Hb2WNYu_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_requests_reviewed_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."membership_requests"')
  ) THEN
    ALTER TABLE "membership_requests" ADD CONSTRAINT "membership_requests_reviewed_by_user_id_users_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_roles_membership_id_memberships_id_fkey' AND conrelid = to_regclass('public."membership_roles"')
  ) THEN
    ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'membership_roles_role_id_roles_id_fkey' AND conrelid = to_regclass('public."membership_roles"')
  ) THEN
    ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_outbox_user_id_users_id_fkey' AND conrelid = to_regclass('public."email_outbox"')
  ) THEN
    ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_outbox_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."email_outbox"')
  ) THEN
    ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_units_organization_id_organizations_id_fkey' AND conrelid = to_regclass('public."organization_units"')
  ) THEN
    ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_units_parent_id_organization_units_id_fkey' AND conrelid = to_regclass('public."organization_units"')
  ) THEN
    ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_parent_id_organization_units_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_units_type_id_organization_unit_types_id_fkey' AND conrelid = to_regclass('public."organization_units"')
  ) THEN
    ALTER TABLE "organization_units" ADD CONSTRAINT "organization_units_type_id_organization_unit_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "organization_unit_types"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_organization_units_parent_same_organization' AND conrelid = to_regclass('public."organization_units"')
  ) THEN
    ALTER TABLE "organization_units" ADD CONSTRAINT "fk_organization_units_parent_same_organization" FOREIGN KEY ("organization_id","parent_id") REFERENCES "organization_units"("organization_id","id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_unit_automations_SR8vBycElpMS_fkey' AND conrelid = to_regclass('public."organization_unit_automations"')
  ) THEN
    ALTER TABLE "organization_unit_automations" ADD CONSTRAINT "organization_unit_automations_SR8vBycElpMS_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_unit_automation_runs_DD6lKImvkn2C_fkey' AND conrelid = to_regclass('public."organization_unit_automation_runs"')
  ) THEN
    ALTER TABLE "organization_unit_automation_runs" ADD CONSTRAINT "organization_unit_automation_runs_DD6lKImvkn2C_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_unit_required_forms_Hp7pYD82jLLL_fkey' AND conrelid = to_regclass('public."organization_unit_required_forms"')
  ) THEN
    ALTER TABLE "organization_unit_required_forms" ADD CONSTRAINT "organization_unit_required_forms_Hp7pYD82jLLL_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_unit_required_forms_twV1Hml42qxX_fkey' AND conrelid = to_regclass('public."organization_unit_required_forms"')
  ) THEN
    ALTER TABLE "organization_unit_required_forms" ADD CONSTRAINT "organization_unit_required_forms_twV1Hml42qxX_fkey" FOREIGN KEY ("form_id") REFERENCES "requirement_forms"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_unit_types_organization_id_organizations_id_fkey' AND conrelid = to_regclass('public."organization_unit_types"')
  ) THEN
    ALTER TABLE "organization_unit_types" ADD CONSTRAINT "organization_unit_types_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_blocks_organization_id_organizations_id_fkey' AND conrelid = to_regclass('public."form_blocks"')
  ) THEN
    ALTER TABLE "form_blocks" ADD CONSTRAINT "form_blocks_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_blocks_created_by_users_id_fkey' AND conrelid = to_regclass('public."form_blocks"')
  ) THEN
    ALTER TABLE "form_blocks" ADD CONSTRAINT "form_blocks_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_blocks_updated_by_users_id_fkey' AND conrelid = to_regclass('public."form_blocks"')
  ) THEN
    ALTER TABLE "form_blocks" ADD CONSTRAINT "form_blocks_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_block_fields_block_id_form_blocks_id_fkey' AND conrelid = to_regclass('public."form_block_fields"')
  ) THEN
    ALTER TABLE "form_block_fields" ADD CONSTRAINT "form_block_fields_block_id_form_blocks_id_fkey" FOREIGN KEY ("block_id") REFERENCES "form_blocks"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_submissions_form_id_requirement_forms_id_fkey' AND conrelid = to_regclass('public."form_submissions"')
  ) THEN
    ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_requirement_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "requirement_forms"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_submissions_user_id_users_id_fkey' AND conrelid = to_regclass('public."form_submissions"')
  ) THEN
    ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_submissions_organization_unit_id_fkey' AND conrelid = to_regclass('public."form_submissions"')
  ) THEN
    ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_organization_unit_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_submission_values_submission_id_form_submissions_id_fkey' AND conrelid = to_regclass('public."form_submission_values"')
  ) THEN
    ALTER TABLE "form_submission_values" ADD CONSTRAINT "form_submission_values_submission_id_form_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_submission_values_field_id_form_block_fields_id_fkey' AND conrelid = to_regclass('public."form_submission_values"')
  ) THEN
    ALTER TABLE "form_submission_values" ADD CONSTRAINT "form_submission_values_field_id_form_block_fields_id_fkey" FOREIGN KEY ("field_id") REFERENCES "form_block_fields"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_user_profiles_WTRTxwUqszuD_fkey' AND conrelid = to_regclass('public."organization_user_profiles"')
  ) THEN
    ALTER TABLE "organization_user_profiles" ADD CONSTRAINT "organization_user_profiles_WTRTxwUqszuD_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_user_profiles_user_id_users_id_fkey' AND conrelid = to_regclass('public."organization_user_profiles"')
  ) THEN
    ALTER TABLE "organization_user_profiles" ADD CONSTRAINT "organization_user_profiles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_user_profile_field_values_7ctvsfO8M450_fkey' AND conrelid = to_regclass('public."organization_user_profile_field_values"')
  ) THEN
    ALTER TABLE "organization_user_profile_field_values" ADD CONSTRAINT "organization_user_profile_field_values_7ctvsfO8M450_fkey" FOREIGN KEY ("organization_user_profile_id") REFERENCES "organization_user_profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_user_profile_field_values_oMMG44VKvNEF_fkey' AND conrelid = to_regclass('public."organization_user_profile_field_values"')
  ) THEN
    ALTER TABLE "organization_user_profile_field_values" ADD CONSTRAINT "organization_user_profile_field_values_oMMG44VKvNEF_fkey" FOREIGN KEY ("field_id") REFERENCES "form_block_fields"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'requirement_forms_organization_id_organizations_id_fkey' AND conrelid = to_regclass('public."requirement_forms"')
  ) THEN
    ALTER TABLE "requirement_forms" ADD CONSTRAINT "requirement_forms_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'requirement_forms_WaMssqa2Hv1A_fkey' AND conrelid = to_regclass('public."requirement_forms"')
  ) THEN
    ALTER TABLE "requirement_forms" ADD CONSTRAINT "requirement_forms_WaMssqa2Hv1A_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'requirement_forms_created_by_users_id_fkey' AND conrelid = to_regclass('public."requirement_forms"')
  ) THEN
    ALTER TABLE "requirement_forms" ADD CONSTRAINT "requirement_forms_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'requirement_forms_updated_by_users_id_fkey' AND conrelid = to_regclass('public."requirement_forms"')
  ) THEN
    ALTER TABLE "requirement_forms" ADD CONSTRAINT "requirement_forms_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'requirement_form_block_refs_form_id_requirement_forms_id_fkey' AND conrelid = to_regclass('public."requirement_form_block_refs"')
  ) THEN
    ALTER TABLE "requirement_form_block_refs" ADD CONSTRAINT "requirement_form_block_refs_form_id_requirement_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "requirement_forms"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'requirement_form_block_refs_block_id_form_blocks_id_fkey' AND conrelid = to_regclass('public."requirement_form_block_refs"')
  ) THEN
    ALTER TABLE "requirement_form_block_refs" ADD CONSTRAINT "requirement_form_block_refs_block_id_form_blocks_id_fkey" FOREIGN KEY ("block_id") REFERENCES "form_blocks"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."shifts"')
  ) THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_created_by_id_users_id_fkey' AND conrelid = to_regclass('public."shifts"')
  ) THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_event_id_events_id_fkey' AND conrelid = to_regclass('public."shifts"')
  ) THEN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_call_out_recipients_instance_id_shift_instances_id_fkey' AND conrelid = to_regclass('public."shift_call_out_recipients"')
  ) THEN
    ALTER TABLE "shift_call_out_recipients" ADD CONSTRAINT "shift_call_out_recipients_instance_id_shift_instances_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "shift_instances"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_call_out_recipients_recipient_id_users_id_fkey' AND conrelid = to_regclass('public."shift_call_out_recipients"')
  ) THEN
    ALTER TABLE "shift_call_out_recipients" ADD CONSTRAINT "shift_call_out_recipients_recipient_id_users_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_call_out_recipients_sent_by_id_users_id_fkey' AND conrelid = to_regclass('public."shift_call_out_recipients"')
  ) THEN
    ALTER TABLE "shift_call_out_recipients" ADD CONSTRAINT "shift_call_out_recipients_sent_by_id_users_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_instances_master_id_shifts_id_fkey' AND conrelid = to_regclass('public."shift_instances"')
  ) THEN
    ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_master_id_shifts_id_fkey" FOREIGN KEY ("master_id") REFERENCES "shifts"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_instance_invites_instance_id_shift_instances_id_fkey' AND conrelid = to_regclass('public."shift_instance_invites"')
  ) THEN
    ALTER TABLE "shift_instance_invites" ADD CONSTRAINT "shift_instance_invites_instance_id_shift_instances_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "shift_instances"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_instance_invites_user_id_users_id_fkey' AND conrelid = to_regclass('public."shift_instance_invites"')
  ) THEN
    ALTER TABLE "shift_instance_invites" ADD CONSTRAINT "shift_instance_invites_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_instance_required_forms_F9ZcBCqsk8fB_fkey' AND conrelid = to_regclass('public."shift_instance_required_forms"')
  ) THEN
    ALTER TABLE "shift_instance_required_forms" ADD CONSTRAINT "shift_instance_required_forms_F9ZcBCqsk8fB_fkey" FOREIGN KEY ("shift_instance_id") REFERENCES "shift_instances"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_instance_required_forms_form_id_requirement_forms_id_fkey' AND conrelid = to_regclass('public."shift_instance_required_forms"')
  ) THEN
    ALTER TABLE "shift_instance_required_forms" ADD CONSTRAINT "shift_instance_required_forms_form_id_requirement_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "requirement_forms"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_instance_understaffed_states_BiLthAFNONXn_fkey' AND conrelid = to_regclass('public."shift_instance_understaffed_states"')
  ) THEN
    ALTER TABLE "shift_instance_understaffed_states" ADD CONSTRAINT "shift_instance_understaffed_states_BiLthAFNONXn_fkey" FOREIGN KEY ("instance_id") REFERENCES "shift_instances"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_invites_shift_id_shifts_id_fkey' AND conrelid = to_regclass('public."shift_invites"')
  ) THEN
    ALTER TABLE "shift_invites" ADD CONSTRAINT "shift_invites_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_invites_user_id_users_id_fkey' AND conrelid = to_regclass('public."shift_invites"')
  ) THEN
    ALTER TABLE "shift_invites" ADD CONSTRAINT "shift_invites_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_manager_notifications_instance_id_shift_instances_id_fkey' AND conrelid = to_regclass('public."shift_manager_notifications"')
  ) THEN
    ALTER TABLE "shift_manager_notifications" ADD CONSTRAINT "shift_manager_notifications_instance_id_shift_instances_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "shift_instances"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_manager_notifications_recipient_id_users_id_fkey' AND conrelid = to_regclass('public."shift_manager_notifications"')
  ) THEN
    ALTER TABLE "shift_manager_notifications" ADD CONSTRAINT "shift_manager_notifications_recipient_id_users_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_required_forms_shift_id_shifts_id_fkey' AND conrelid = to_regclass('public."shift_required_forms"')
  ) THEN
    ALTER TABLE "shift_required_forms" ADD CONSTRAINT "shift_required_forms_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shift_required_forms_form_id_requirement_forms_id_fkey' AND conrelid = to_regclass('public."shift_required_forms"')
  ) THEN
    ALTER TABLE "shift_required_forms" ADD CONSTRAINT "shift_required_forms_form_id_requirement_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "requirement_forms"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'volunteer_digest_shift_logs_user_id_users_id_fkey' AND conrelid = to_regclass('public."volunteer_digest_shift_logs"')
  ) THEN
    ALTER TABLE "volunteer_digest_shift_logs" ADD CONSTRAINT "volunteer_digest_shift_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'volunteer_digest_shift_logs_shift_id_shifts_id_fkey' AND conrelid = to_regclass('public."volunteer_digest_shift_logs"')
  ) THEN
    ALTER TABLE "volunteer_digest_shift_logs" ADD CONSTRAINT "volunteer_digest_shift_logs_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'volunteer_digest_shift_logs_instance_id_shift_instances_id_fkey' AND conrelid = to_regclass('public."volunteer_digest_shift_logs"')
  ) THEN
    ALTER TABLE "volunteer_digest_shift_logs" ADD CONSTRAINT "volunteer_digest_shift_logs_instance_id_shift_instances_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "shift_instances"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'volunteer_digest_shift_logs_JEmEZNy2ijpb_fkey' AND conrelid = to_regclass('public."volunteer_digest_shift_logs"')
  ) THEN
    ALTER TABLE "volunteer_digest_shift_logs" ADD CONSTRAINT "volunteer_digest_shift_logs_JEmEZNy2ijpb_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'files_uploaded_by_user_id_users_id_fkey' AND conrelid = to_regclass('public."files"')
  ) THEN
    ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_users_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'files_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."files"')
  ) THEN
    ALTER TABLE "files" ADD CONSTRAINT "files_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_acceptances_user_id_users_id_fkey' AND conrelid = to_regclass('public."terms_acceptances"')
  ) THEN
    ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'terms_notifications_user_id_users_id_fkey' AND conrelid = to_regclass('public."terms_notifications"')
  ) THEN
    ALTER TABLE "terms_notifications" ADD CONSTRAINT "terms_notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'time_entries_shift_instance_id_shift_instances_id_fkey' AND conrelid = to_regclass('public."time_entries"')
  ) THEN
    ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_shift_instance_id_shift_instances_id_fkey" FOREIGN KEY ("shift_instance_id") REFERENCES "shift_instances"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'time_entries_organization_unit_id_organization_units_id_fkey' AND conrelid = to_regclass('public."time_entries"')
  ) THEN
    ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'time_entries_volunteer_id_users_id_fkey' AND conrelid = to_regclass('public."time_entries"')
  ) THEN
    ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_volunteer_id_users_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "users"("id") ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'time_entries_created_by_id_users_id_fkey' AND conrelid = to_regclass('public."time_entries"')
  ) THEN
    ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_created_by_id_users_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_unit_invitations_user_id_users_id_fkey' AND conrelid = to_regclass('public."organization_unit_invitations"')
  ) THEN
    ALTER TABLE "organization_unit_invitations" ADD CONSTRAINT "organization_unit_invitations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_unit_invitations_opaCb4ITz7BU_fkey' AND conrelid = to_regclass('public."organization_unit_invitations"')
  ) THEN
    ALTER TABLE "organization_unit_invitations" ADD CONSTRAINT "organization_unit_invitations_opaCb4ITz7BU_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
-- Seed row required by core (idempotent).
INSERT INTO "users" ("id", "name", "email", "check_in_id", "firstname", "lastname")
VALUES ('system-automated', 'Caluno Automated System', 'system-automated@caluno.internal', 'system-automated-checkin', 'Caluno', 'Automated System')
ON CONFLICT ("id") DO NOTHING;
