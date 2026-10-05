-- VOLI-1524: UserProfile system key name → firstname (matches lastname naming).
--
-- Requirement-form blocks bound to the old key must move with the code rename;
-- submitted answers are left alone (historical record).
UPDATE "form_block_fields"
SET "system_key" = 'firstname'
WHERE "system_key" = 'name';
--> statement-breakpoint
-- UserProfile.data JSON key name → firstname (preserve value, drop old key).
UPDATE "user_profiles"
SET "data" = ("data" - 'name') || jsonb_build_object('firstname', "data" -> 'name')
WHERE "data" ? 'name';
