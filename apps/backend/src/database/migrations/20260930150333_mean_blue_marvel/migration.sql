-- VOLI-1524: backfill mandatory firstname/lastname from users.name, sync name, then NOT NULL.
-- Backfill rules (blank = null / empty / whitespace-only after trim):
--   both filled → trim parts; both blank → split name on first space (or lastname='Lastname');
--   exactly one filled → fill the other from trimmed name.
UPDATE "users" SET
  "firstname" = CASE
    WHEN NULLIF(TRIM(COALESCE("firstname", '')), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE("lastname", '')), '') IS NOT NULL
      THEN TRIM("firstname")
    WHEN NULLIF(TRIM(COALESCE("firstname", '')), '') IS NOT NULL
      THEN TRIM("firstname")
    WHEN NULLIF(TRIM(COALESCE("lastname", '')), '') IS NOT NULL
      THEN TRIM("name")
    WHEN POSITION(' ' IN TRIM("name")) = 0
      THEN TRIM("name")
    ELSE TRIM(SUBSTRING(TRIM("name") FROM 1 FOR POSITION(' ' IN TRIM("name")) - 1))
  END,
  "lastname" = CASE
    WHEN NULLIF(TRIM(COALESCE("firstname", '')), '') IS NOT NULL
      AND NULLIF(TRIM(COALESCE("lastname", '')), '') IS NOT NULL
      THEN TRIM("lastname")
    WHEN NULLIF(TRIM(COALESCE("lastname", '')), '') IS NOT NULL
      THEN TRIM("lastname")
    WHEN NULLIF(TRIM(COALESCE("firstname", '')), '') IS NOT NULL
      THEN TRIM("name")
    WHEN POSITION(' ' IN TRIM("name")) = 0
      THEN 'Lastname'
    ELSE NULLIF(TRIM(SUBSTRING(TRIM("name") FROM POSITION(' ' IN TRIM("name")) + 1)), '')
  END;--> statement-breakpoint
-- Empty remainder after first space → Lastname
UPDATE "users" SET "lastname" = 'Lastname' WHERE NULLIF(TRIM(COALESCE("lastname", '')), '') IS NULL;--> statement-breakpoint
-- Sync Better Auth display name from firstname + lastname
UPDATE "users" SET "name" = "firstname" || ' ' || "lastname";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "firstname" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "lastname" SET NOT NULL;
