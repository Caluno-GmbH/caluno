-- VOLI-1351: bring stored timesheet templates up to the preset this ticket changed.
--
-- Template bodies are per-organisation jsonb snapshots taken when a coordinator
-- first opens the builder, so changing the preset alone leaves every existing
-- template on the old shape. This backfills them, following the same rules as
-- 20260922143300_pauschale_document_wording:
--
--   * only rows still carrying the exact preset shape are touched, so a
--     coordinator who edited a passage keeps their version;
--   * scope is "document_templates" only. Issued contracts and invoices carry a
--     document number and a rendered file; they are a legal record and are never
--     rewritten. This migration does not reference those tables.

-- 1. The rate column was headed "Stundensatz", which was the widest thing in it
--    while a rate cell reads "8,00 €". Matched as the whole three-column run so
--    the word is only replaced where it is a column header.
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  '"Stunden gesamt", "Stundensatz", "Betrag"',
  '"Stunden gesamt", "€/h", "Betrag"'
)::jsonb
WHERE "kind" = 'INVOICE'
  AND "body"::text LIKE '%"Stunden gesamt", "Stundensatz", "Betrag"%';
--> statement-breakpoint

-- 2. The renderer never consulted firstColumnSource — it always printed the
--    shift name whatever the template said. Now that it obeys the setting, a
--    template still saying "agreement_task_description" would silently change
--    what its documents print. Moved to the source that matches their output.
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  '"firstColumnSource": "agreement_task_description"',
  '"firstColumnSource": "shift_name"'
)::jsonb
WHERE "kind" = 'INVOICE'
  AND "body"::text LIKE '%"firstColumnSource": "agreement_task_description"%';
--> statement-breakpoint

-- 3. The document number and date printed bare, with nothing saying which was
--    which next to the organisation's letterhead.
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  '"text": "{documentNumber}"',
  '"text": "Rechnungsnummer: {documentNumber}"'
)::jsonb
WHERE "kind" = 'INVOICE'
  AND "body"::text LIKE '%"text": "{documentNumber}"%';
--> statement-breakpoint

UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  '"text": "{date}"',
  '"text": "Datum: {date}"'
)::jsonb
WHERE "kind" = 'INVOICE'
  AND "body"::text LIKE '%"text": "{date}"%';
--> statement-breakpoint

-- 4. Two number formats state the cost centre inside the number itself. Where
--    one of those is selected and the Kostenstelle line is still switched off,
--    the number renders a dash where the cost centre belongs.
UPDATE "document_templates" dt
SET "body" = jsonb_set(
  dt."body",
  '{header,metaLines}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN line->>'id' = 'meta-kostenstelle'
          THEN jsonb_set(line, '{enabled}', 'true'::jsonb)
        ELSE line
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(dt."body" -> 'header' -> 'metaLines')
      WITH ORDINALITY AS meta(line, ord)
  )
)
WHERE dt."kind" = 'INVOICE'
  AND dt."invoice_number_format" IN (
    'date-kostenstelle-number',
    'kostenstelle-month-year-number'
  )
  AND jsonb_typeof(dt."body" -> 'header' -> 'metaLines') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dt."body" -> 'header' -> 'metaLines') AS line
    WHERE line->>'id' = 'meta-kostenstelle'
      AND line->>'enabled' = 'false'
  );
--> statement-breakpoint

-- 5. The optional free-text block above the signatures, which contracts have
--    had all along. Appended last so it prints above the signatures, and off by
--    default — a coordinator switches it on when they want it. Skips templates
--    with no blocks at all (stubs that were never configured), which would
--    otherwise end up holding nothing but a free-text field.
UPDATE "document_templates" dt
SET "body" = jsonb_set(
  dt."body",
  '{blocks}',
  (dt."body" -> 'blocks') || jsonb_build_array(
    jsonb_build_object(
      'kind', 'text',
      'id', 'sonstiges',
      'title', 'Sonstiges',
      'locked', false,
      'enabled', false,
      'lines', jsonb_build_array(
        jsonb_build_object(
          'id', 'freeform',
          'text', '{freeformText}',
          'optional', false,
          'enabled', true,
          'fields', jsonb_build_array(
            jsonb_build_object(
              'id', 'freeform-text',
              'control', 'textarea',
              'value', jsonb_build_object('kind', 'manual-template', 'value', '')
            )
          )
        )
      )
    )
  )
)
WHERE dt."kind" = 'INVOICE'
  AND jsonb_typeof(dt."body" -> 'blocks') = 'array'
  AND jsonb_array_length(dt."body" -> 'blocks') > 0
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dt."body" -> 'blocks') AS block
    WHERE block->>'id' = 'sonstiges'
  );