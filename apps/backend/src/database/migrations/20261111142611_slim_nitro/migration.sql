-- Contracts and invoices always belong to a concrete organization unit.
-- Legacy org-wide rows (NULL unit) are attributed to the organisation's root
-- unit — the same fallback create/draft paths used before this constraint.

UPDATE "contracts" AS c
SET "organization_unit_id" = root.id
FROM "document_templates" AS dt
INNER JOIN "organization_units" AS root
  ON root.organization_id = dt.organization_id
 AND root.parent_id IS NULL
WHERE c.document_template_id = dt.id
  AND c.organization_unit_id IS NULL;--> statement-breakpoint

UPDATE "invoices" AS i
SET "organization_unit_id" = root.id
FROM "document_templates" AS dt
INNER JOIN "organization_units" AS root
  ON root.organization_id = dt.organization_id
 AND root.parent_id IS NULL
WHERE i.document_template_id = dt.id
  AND i.organization_unit_id IS NULL;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "contracts" WHERE "organization_unit_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill contracts.organization_unit_id for all rows';
  END IF;
  IF EXISTS (SELECT 1 FROM "invoices" WHERE "organization_unit_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill invoices.organization_unit_id for all rows';
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "contracts" ALTER COLUMN "organization_unit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "organization_unit_id" SET NOT NULL;
