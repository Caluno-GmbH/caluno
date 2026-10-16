-- VOLI-1524: merge user_profiles into users (typed columns), then drop profile table.
ALTER TABLE "users" ADD COLUMN "firstname" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lastname" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "zip" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "birthdate" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "iban" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_holder" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bic" text;--> statement-breakpoint
-- Backfill from user_profiles.data (system keys → columns).
UPDATE "users" AS u
SET
  "firstname" = COALESCE(u."firstname", NULLIF(p."data"->>'firstname', '')),
  "lastname" = COALESCE(u."lastname", NULLIF(p."data"->>'lastname', '')),
  "preferred_name" = COALESCE(u."preferred_name", NULLIF(p."data"->>'preferred-name', '')),
  "gender" = COALESCE(u."gender", NULLIF(p."data"->>'gender', '')),
  "phone" = COALESCE(u."phone", NULLIF(p."data"->>'phone', '')),
  "street" = COALESCE(u."street", NULLIF(p."data"->>'street', '')),
  "zip" = COALESCE(u."zip", NULLIF(p."data"->>'zip', '')),
  "city" = COALESCE(u."city", NULLIF(p."data"->>'city', '')),
  "birthdate" = COALESCE(
    u."birthdate",
    NULLIF(p."data"->>'birthdate', ''),
    NULLIF(p."data"->>'birth-date', '')
  ),
  "iban" = COALESCE(u."iban", NULLIF(p."data"->>'iban', '')),
  "account_holder" = COALESCE(u."account_holder", NULLIF(p."data"->>'account-holder', '')),
  "bic" = COALESCE(u."bic", NULLIF(p."data"->>'bic', ''))
FROM "user_profiles" AS p
WHERE p."user_id" = u."id";--> statement-breakpoint
-- Rename form field system key birth-date → birthdate.
UPDATE "form_block_fields"
SET "system_key" = 'birthdate'
WHERE "system_key" = 'birth-date';--> statement-breakpoint
DROP TABLE "user_profiles";
