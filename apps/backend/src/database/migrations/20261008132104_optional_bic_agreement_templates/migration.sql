-- VOLI-1544: stop stored templates demanding a BIC, and offer it as an opt-in.
--
-- Template bodies are per-organisation jsonb snapshots taken when a coordinator
-- first opens the builder, so changing the preset alone leaves every existing
-- template on the old shape. This backfill follows the same rules as
-- 20260924090108_timesheet_template_catchup:
--
--   * each row is rewritten from its own body only; nothing is read across
--     rows or organisations;
--   * scope is "document_templates" only. Issued contracts and invoices carry a
--     document number and a rendered file; they are a legal record and are
--     never rewritten. This migration does not reference those tables.
--
-- SEPA payouts do not need a BIC; only non-EU accounts do. A coordinator with
-- non-EU volunteers switches the line on.

-- 1. Agreements stored the BIC line with optional: false, which the builder
--    renders without a Switch, so every agreement demanded a BIC. Mark it
--    optional and switch it off, matching the new-preset default. Only lines
--    still mandatory are touched, so rerunning never switches off a BIC a
--    coordinator has since opted into.
UPDATE "document_templates" dt
SET "body" = jsonb_set(
  dt."body",
  '{blocks}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(block -> 'lines') = 'array'
        THEN jsonb_set(
          block,
          '{lines}',
          -- jsonb_agg over an empty "lines" array yields NULL, which would turn
          -- the whole block into null; keep it an empty array instead.
          COALESCE(
            (
              SELECT jsonb_agg(
                CASE
                  WHEN line->>'id' = 'payout-bic'
                    AND line->>'optional' IS DISTINCT FROM 'true'
                  THEN jsonb_set(
                    jsonb_set(line, '{optional}', 'true'::jsonb),
                    '{enabled}', 'false'::jsonb
                  )
                  ELSE line
                END
                ORDER BY line_ord
              )
              FROM jsonb_array_elements(block -> 'lines')
                WITH ORDINALITY AS l(line, line_ord)
            ),
            '[]'::jsonb
          )
        )
        ELSE block
      END
      ORDER BY block_ord
    )
    FROM jsonb_array_elements(dt."body" -> 'blocks')
      WITH ORDINALITY AS b(block, block_ord)
  )
)
WHERE dt."kind" = 'CONTRACT'
  AND jsonb_typeof(dt."body" -> 'blocks') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dt."body" -> 'blocks') AS block,
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(block -> 'lines') = 'array'
             THEN block -> 'lines'
             ELSE '[]'::jsonb
           END
         ) AS line
    WHERE line->>'id' = 'payout-bic'
      AND line->>'optional' IS DISTINCT FROM 'true'
  );
--> statement-breakpoint

-- 2. Timesheets never had a BIC line. The preset now offers one, switched off,
--    directly after the IBAN; saved timesheets get the same line so every
--    organisation can opt in, not only those that never opened the builder.
--    Skips templates that already carry it (rerun-safe) and templates without
--    an IBAN line to anchor it to.
UPDATE "document_templates" dt
SET "body" = jsonb_set(
  dt."body",
  '{blocks}',
  (
    SELECT jsonb_agg(
      CASE
        -- @> is simply false when "lines" is not an array, where
        -- jsonb_array_elements would raise.
        WHEN block -> 'lines' @> '[{"id": "volunteer-iban"}]'
        THEN jsonb_set(
          block,
          '{lines}',
          (
            SELECT jsonb_agg(entry ORDER BY line_ord, after_iban)
            FROM (
              SELECT line AS entry, line_ord, 0 AS after_iban
              FROM jsonb_array_elements(block -> 'lines')
                WITH ORDINALITY AS l(line, line_ord)
              UNION ALL
              SELECT
                jsonb_build_object(
                  'id', 'volunteer-bic',
                  'text', '{volunteerBic} (BIC)',
                  'fields', jsonb_build_array(
                    jsonb_build_object(
                      'id', 'volunteer-bic-field',
                      'value', jsonb_build_object(
                        'kind', 'bound',
                        'source', 'volunteer_bic'
                      )
                    )
                  ),
                  'optional', true,
                  'enabled', false
                ),
                line_ord,
                1
              FROM jsonb_array_elements(block -> 'lines')
                WITH ORDINALITY AS l(line, line_ord)
              WHERE line->>'id' = 'volunteer-iban'
            ) AS lines_with_bic
          )
        )
        ELSE block
      END
      ORDER BY block_ord
    )
    FROM jsonb_array_elements(dt."body" -> 'blocks')
      WITH ORDINALITY AS b(block, block_ord)
  )
)
WHERE dt."kind" = 'INVOICE'
  AND jsonb_typeof(dt."body" -> 'blocks') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dt."body" -> 'blocks') AS block
    WHERE block -> 'lines' @> '[{"id": "volunteer-iban"}]'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dt."body" -> 'blocks') AS block
    WHERE block -> 'lines' @> '[{"id": "volunteer-bic"}]'
  );
--> statement-breakpoint
