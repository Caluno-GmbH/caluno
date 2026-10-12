CREATE TABLE "todo_fill_filters" (
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
ALTER TABLE "todo_fill_filters" ADD CONSTRAINT "todo_fill_filters_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "todo_fill_filters" ADD CONSTRAINT "todo_fill_filters_fDZ5fe6oxg0X_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE CASCADE;