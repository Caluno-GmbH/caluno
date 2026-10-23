CREATE TABLE "organization_user_profile_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_user_profile_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_org_user_profile_field_values_profile_field" UNIQUE("organization_user_profile_id","field_id")
);
--> statement-breakpoint
CREATE INDEX "idx_org_user_profile_field_values_profile_id" ON "organization_user_profile_field_values" ("organization_user_profile_id");
--> statement-breakpoint
CREATE INDEX "idx_org_user_profile_field_values_field_id" ON "organization_user_profile_field_values" ("field_id");
--> statement-breakpoint
ALTER TABLE "organization_user_profile_field_values" ADD CONSTRAINT "organization_user_profile_field_values_7ctvsfO8M450_fkey" FOREIGN KEY ("organization_user_profile_id") REFERENCES "organization_user_profiles"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "organization_user_profile_field_values" ADD CONSTRAINT "organization_user_profile_field_values_oMMG44VKvNEF_fkey" FOREIGN KEY ("field_id") REFERENCES "form_block_fields"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO "organization_user_profile_field_values" (
	"id",
	"organization_user_profile_id",
	"field_id",
	"value",
	"created_at",
	"updated_at"
)
SELECT DISTINCT ON ("organization_user_profile_id", "field_id")
	gen_random_uuid(),
	"organization_user_profile_id",
	"field_id",
	"value",
	"created_at",
	"updated_at"
FROM "form_submission_values"
WHERE "organization_user_profile_id" IS NOT NULL
ORDER BY "organization_user_profile_id", "field_id", "updated_at" DESC;
--> statement-breakpoint
ALTER TABLE "form_submission_values" DROP CONSTRAINT "form_submission_values_organization_user_profile_id_fkey";
--> statement-breakpoint
DROP INDEX "idx_form_submission_values_organization_user_profile_id";
--> statement-breakpoint
DROP INDEX "uq_form_submission_values_profile_field";
--> statement-breakpoint
ALTER TABLE "form_submission_values" DROP COLUMN "organization_user_profile_id";
