CREATE TABLE "organization_unit_invitations" (
	"user_id" text,
	"organization_unit_id" uuid,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_unit_invitations_pkey" PRIMARY KEY("user_id","organization_unit_id")
);
--> statement-breakpoint
ALTER TABLE "organization_unit_invitations" ADD CONSTRAINT "organization_unit_invitations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_unit_invitations" ADD CONSTRAINT "organization_unit_invitations_opaCb4ITz7BU_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;