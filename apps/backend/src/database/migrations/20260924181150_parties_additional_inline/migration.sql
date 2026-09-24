-- VOLI-1443: the optional line about the contracting parties reads on from the
-- address rather than dropping to a line of its own.
--
-- 20260924181149_contract_org_override_catchup inserted it as an ordinary line,
-- which printed it under the town. It belongs to that sentence, so it is marked
-- `inline` and the renderers join it to the line before, wrapping only when it
-- runs out of room.
--
-- Only the line this migration's predecessor created is touched; a coordinator
-- who has since rewritten the block keeps their version, and issued contracts
-- are never rewritten.
UPDATE "document_templates" dt
SET "body" = jsonb_set(
  dt."body",
  '{blocks}',
  (
    SELECT jsonb_agg(
             CASE
               WHEN blk->>'id' <> 'persoenliche-daten' THEN blk
               ELSE jsonb_set(blk, '{lines}', (
                 SELECT jsonb_agg(
                          CASE
                            WHEN l.line->>'id' = 'parties-additional'
                              THEN jsonb_set(l.line, '{inline}', 'true'::jsonb)
                            ELSE l.line
                          END
                          ORDER BY l.ord
                        )
                 FROM jsonb_array_elements(blk->'lines')
                        WITH ORDINALITY AS l(line, ord)
               ))
             END
             ORDER BY b.ord
           )
    FROM jsonb_array_elements(dt."body"->'blocks') WITH ORDINALITY AS b(blk, ord)
  )
)
WHERE dt."kind" = 'CONTRACT'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dt."body"->'blocks') AS blk,
         jsonb_array_elements(coalesce(blk->'lines', '[]'::jsonb)) AS line
    WHERE line->>'id' = 'parties-additional'
      AND line->'inline' IS NULL
  );