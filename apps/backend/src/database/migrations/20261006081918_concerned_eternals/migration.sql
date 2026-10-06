CREATE TYPE "terms_change_class" AS ENUM('MINOR', 'MAJOR');--> statement-breakpoint
CREATE TABLE "terms_acceptances" (
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
CREATE TABLE "terms_notifications" (
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
CREATE TABLE "terms_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" text NOT NULL CONSTRAINT "terms_versions_version_key" UNIQUE,
	"class" "terms_change_class" NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_terms_acceptances_user_id" ON "terms_acceptances" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_terms_notifications_user_id" ON "terms_notifications" ("user_id");--> statement-breakpoint
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "terms_notifications" ADD CONSTRAINT "terms_notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;