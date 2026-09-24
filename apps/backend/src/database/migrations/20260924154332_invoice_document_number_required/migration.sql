-- Every timesheet must store the document number it was issued under.
--
-- The columns were added nullable for rows that predated numbering; those
-- still render a display-only fallback from the template format. Allocate
-- real numbers the same way create does (scope unit, Berlin calendar year,
-- per-year sequence, template format + Kostenstelle). Drop any row that
-- still cannot be numbered (e.g. no org root to scope to), then require the
-- columns and replace the partial unique index with a full one.

WITH invoice_context AS (
  SELECT
    i.id AS invoice_id,
    COALESCE(
      i.organization_unit_id,
      (
        SELECT root.id
        FROM "organization_units" AS root
        WHERE root.organization_id = dt.organization_id
          AND root.parent_id IS NULL
        LIMIT 1
      )
    ) AS scope_unit_id,
    EXTRACT(
      YEAR FROM (i.period_start AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')
    )::integer AS document_year,
    (i.period_start AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date AS berlin_date,
    COALESCE(NULLIF(trim(dt.invoice_number_format), ''), 'date-number') AS invoice_format,
    COALESCE(
      NULLIF(trim(i.field_overrides ->> 'kostenstelle'), ''),
      NULLIF(
        trim(
          jsonb_path_query_first(
            i.resolved_body,
            '$.**.fields[*] ? (@.id == "kostenstelle" && @.value.kind == "manual-template").value.value'
          ) #>> '{}'
        ),
        ''
      ),
      '—'
    ) AS kostenstelle,
    i.created_at
  FROM "invoices" AS i
  INNER JOIN "document_templates" AS dt ON dt.id = i.document_template_id
  WHERE i.document_number IS NULL
),
existing_max AS (
  SELECT
    document_number_scope_unit_id AS scope_unit_id,
    document_number_year AS document_year,
    COALESCE(MAX(document_number_seq), 0) AS max_seq
  FROM "invoices"
  WHERE document_number_seq IS NOT NULL
  GROUP BY 1, 2
),
numbered AS (
  SELECT
    ic.*,
    COALESCE(em.max_seq, 0)
      + ROW_NUMBER() OVER (
        PARTITION BY ic.scope_unit_id, ic.document_year
        ORDER BY ic.created_at ASC, ic.invoice_id ASC
      ) AS document_seq
  FROM invoice_context AS ic
  LEFT JOIN existing_max AS em
    ON em.scope_unit_id = ic.scope_unit_id
   AND em.document_year = ic.document_year
),
formatted AS (
  SELECT
    n.invoice_id,
    n.scope_unit_id,
    n.document_year,
    n.document_seq,
    CASE n.invoice_format
      WHEN 'date-kostenstelle-number' THEN
        to_char(n.berlin_date, 'YYYYMMDD')
        || '-'
        || n.kostenstelle
        || '-'
        || lpad(n.document_seq::text, 3, '0')
      WHEN 'compact-date-number' THEN
        to_char(n.berlin_date, 'YYMMDD') || lpad(n.document_seq::text, 3, '0')
      WHEN 'kostenstelle-month-year-number' THEN
        n.kostenstelle
        || '-'
        || to_char(n.berlin_date, 'MM')
        || '.'
        || to_char(n.berlin_date, 'YYYY')
        || '-'
        || lpad(n.document_seq::text, 3, '0')
      ELSE
        to_char(n.berlin_date, 'YYYYMMDD')
        || '-'
        || lpad(n.document_seq::text, 3, '0')
    END AS document_number
  FROM numbered AS n
)
UPDATE "invoices" AS i
SET
  "document_number_scope_unit_id" = f.scope_unit_id,
  "document_number_year" = f.document_year,
  "document_number_seq" = f.document_seq,
  "document_number" = f.document_number
FROM formatted AS f
WHERE i.id = f.invoice_id;
--> statement-breakpoint

DELETE FROM "invoices"
WHERE "document_number" IS NULL
   OR "document_number_seq" IS NULL
   OR "document_number_year" IS NULL
   OR "document_number_scope_unit_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "invoices" ALTER COLUMN "document_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "document_number_seq" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "document_number_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "document_number_scope_unit_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "uq_invoices_document_number";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoices_document_number" ON "invoices" ("document_number_scope_unit_id","document_number");
