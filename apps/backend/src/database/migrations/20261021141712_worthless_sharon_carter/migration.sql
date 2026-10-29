CREATE TYPE "email_category" AS ENUM('CALL_OUT', 'CALL_OUT_NO_RECIPIENTS', 'MANAGER_NOTIFICATION', 'DIGEST', 'INVITE_REMINDER', 'NOTIFICATION', 'AUTH', 'SUPPORT');--> statement-breakpoint
CREATE TYPE "email_delivery_status" AS ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "email_outbox" (
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
ALTER TABLE "shift_call_out_recipients" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "shift_manager_notifications" DROP COLUMN "status";--> statement-breakpoint
CREATE INDEX "idx_email_outbox_status_next_attempt" ON "email_outbox" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_organization_unit_created_at" ON "email_outbox" ("organization_unit_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_user_id" ON "email_outbox" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_outbox_provider_message_id" ON "email_outbox" ("provider_message_id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_organization_unit_id_organization_units_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE SET NULL;--> statement-breakpoint
DROP TYPE "shift_call_out_delivery_status";