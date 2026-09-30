ALTER TABLE "organizations" RENAME COLUMN "address" TO "street";--> statement-breakpoint
ALTER TABLE "organization_units" RENAME COLUMN "address" TO "street";--> statement-breakpoint
-- Requirement-profile system field key address → street (form field bindings).
UPDATE "form_block_fields"
SET "system_key" = 'street'
WHERE "system_key" = 'address';--> statement-breakpoint
-- UserProfile.data JSON key address → street (preserve value, drop old key).
UPDATE "user_profiles"
SET "data" = ("data" - 'address') || jsonb_build_object('street', "data" -> 'address')
WHERE "data" ? 'address';
