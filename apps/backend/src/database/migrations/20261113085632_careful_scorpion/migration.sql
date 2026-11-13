CREATE TABLE "organization_unit_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"organization_unit_id" uuid NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_organization_unit_invitations_user_id_organization_unit_id" UNIQUE("user_id","organization_unit_id")
);
--> statement-breakpoint
ALTER TABLE "organization_unit_invitations" ADD CONSTRAINT "organization_unit_invitations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_unit_invitations" ADD CONSTRAINT "organization_unit_invitations_opaCb4ITz7BU_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;
