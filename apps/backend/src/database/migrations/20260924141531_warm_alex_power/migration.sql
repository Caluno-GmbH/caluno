-- VOLI-1351: every timesheet must store the rate it was issued at.
--
-- The column was added nullable; older rows still resolve the organisation's
-- current rate at render time. Freeze that rate onto the row so the page
-- cannot drift when the organisation later changes what it pays, then make
-- the column required.
--
-- Resolution mirrors document-rendering's fallback for a null stored rate:
-- invoice unit → template unit → org root unit, then walk that unit's
-- ancestors and the org-wide rate, and finally the platform default.

WITH RECURSIVE invoice_context AS (
  SELECT
    i.id AS invoice_id,
    i.reimbursement_type_id,
    dt.organization_id,
    COALESCE(
      i.organization_unit_id,
      dt.organization_unit_id,
      (
        SELECT root.id
        FROM "organization_units" AS root
        WHERE root.organization_id = dt.organization_id
          AND root.parent_id IS NULL
        LIMIT 1
      )
    ) AS resolution_unit_id
  FROM "invoices" AS i
  INNER JOIN "document_templates" AS dt ON dt.id = i.document_template_id
  WHERE i.hourly_rate_cents IS NULL
),
ancestors AS (
  SELECT
    ic.invoice_id,
    ic.reimbursement_type_id,
    ic.organization_id,
    ic.resolution_unit_id AS unit_id,
    0 AS depth
  FROM invoice_context AS ic
  WHERE ic.resolution_unit_id IS NOT NULL

  UNION ALL

  SELECT
    a.invoice_id,
    a.reimbursement_type_id,
    a.organization_id,
    ou.parent_id AS unit_id,
    a.depth + 1
  FROM ancestors AS a
  INNER JOIN "organization_units" AS ou ON ou.id = a.unit_id
  WHERE ou.parent_id IS NOT NULL
),
chain AS (
  SELECT invoice_id, reimbursement_type_id, organization_id, unit_id, depth
  FROM ancestors

  UNION ALL

  -- Org-wide rate row (organization_unit_id IS NULL), after every unit link.
  SELECT
    ic.invoice_id,
    ic.reimbursement_type_id,
    ic.organization_id,
    NULL::uuid AS unit_id,
    1000000 AS depth
  FROM invoice_context AS ic
),
matched_overrides AS (
  SELECT DISTINCT ON (c.invoice_id)
    c.invoice_id,
    rr.hourly_rate_cents
  FROM chain AS c
  INNER JOIN "reimbursement_rates" AS rr
    ON rr.organization_id = c.organization_id
   AND rr.reimbursement_type_id = c.reimbursement_type_id
   AND (
     (c.unit_id IS NULL AND rr.organization_unit_id IS NULL)
     OR rr.organization_unit_id = c.unit_id
   )
  ORDER BY c.invoice_id, c.depth ASC
)
UPDATE "invoices" AS i
SET "hourly_rate_cents" = COALESCE(
  mo.hourly_rate_cents,
  rt.platform_default_rate_cents
)
FROM invoice_context AS ic
INNER JOIN "reimbursement_types" AS rt ON rt.id = ic.reimbursement_type_id
LEFT JOIN matched_overrides AS mo ON mo.invoice_id = ic.invoice_id
WHERE i.id = ic.invoice_id;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "invoices"
    WHERE "hourly_rate_cents" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill invoices.hourly_rate_cents for all rows';
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "invoices" ALTER COLUMN "hourly_rate_cents" SET NOT NULL;
