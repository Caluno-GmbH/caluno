-- VOLI-1489: the Steuer-ID is no longer collected, so stored values go too.
--
-- The field is gone from the profile, from the system profile keys and from
-- the document data sources, which leaves any value already stored under
-- "tax-id" unreachable: nothing reads it and nobody can edit or clear it. A
-- tax identification number is not something to keep lying in a jsonb column
-- with no purpose and no way to remove it.
--
-- Requirement-form blocks bound to the key are dropped for the same reason —
-- a block whose system field no longer exists renders nothing and cannot be
-- answered. Submitted answers are left alone; they are a record of what a
-- volunteer actually filled in, and are not rewritten.
DELETE FROM "form_block_fields" WHERE "system_key" = 'tax-id';
--> statement-breakpoint

UPDATE "user_profiles"
SET "data" = "data" - 'tax-id'
WHERE "data" ? 'tax-id';
