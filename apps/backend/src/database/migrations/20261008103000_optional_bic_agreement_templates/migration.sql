-- VOLI-1544: make the BIC line optional on stored agreement templates.
--
-- Template bodies are per-organisation jsonb snapshots taken when a coordinator
-- first opens the builder, so changing the preset alone leaves every existing
-- template demanding BIC (the line is stored with optional: false, which the
-- builder renders without a Switch). This backfill follows the same rules as
-- 20260924090108_timesheet_template_catchup:
--
--   * only rows still carrying a "payout-bic" line are touched, so a
--     coordinator who removed the line keeps their version;
--   * scope is "document_templates" only. Issued contracts and invoices carry a
--     document number and a rendered file; they are a legal record and are
--     never rewritten. This migration does not reference those tables.
--
-- SEPA payouts do not need a BIC; only non-EU accounts do. The line is marked
-- optional (so the builder shows its Switch) and switched off, matching the
-- new-preset default. A coordinator with non-EU volunteers switches it back on.

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
          (
            SELECT jsonb_agg(
              CASE
                WHEN line->>'id' = 'payout-bic'
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
         jsonb_array_elements(block -> 'lines') AS line
    WHERE line->>'id' = 'payout-bic'
  );
--> statement-breakpoint
