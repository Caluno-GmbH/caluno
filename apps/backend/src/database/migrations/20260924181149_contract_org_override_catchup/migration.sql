-- VOLI-1443: bring stored contract templates up to the restructured parties block.
--
-- Template bodies are per-organisation jsonb snapshots taken when a coordinator
-- first opens the builder, so the preset change alone leaves existing templates
-- on the old sentence — no postcode or town, and no optional line to switch on.
--
-- The ticket originally said "no migration, newly created templates only", on
-- the grounds that every existing template is test data that can be recreated.
-- The second half turned out to be false: nothing in the interface deletes a
-- document template, so there is no way to recreate one. Reversed here.
--
-- Same rules as 20260922143300_pauschale_document_wording:
--   * only rows still carrying the exact preset shape are touched, so a
--     coordinator who edited the sentence keeps their version;
--   * scope is "document_templates" only. Issued contracts carry a rendered
--     file and are a legal record; they are never rewritten.
--
-- Runs after 20260924145529_rename_address_to_street, which rewrites stored
-- bodies onto the org_street naming, so the sentence is matched in its
-- post-rename form. Nothing upstream backfills the organisation's postcode and
-- town into this line — the preset gained them, stored templates did not.

-- 1. The parties sentence gains the postcode and town, the conjunction moves to
--    the volunteer line, and the optional line is inserted between the two
--    parties. Done in one rebuild of the block's line array because inserting a
--    line means emitting two entries where one was.
UPDATE "document_templates" dt
SET "body" = jsonb_set(
  dt."body",
  '{blocks}',
  (
    SELECT jsonb_agg(
             CASE
               WHEN blk->>'id' <> 'persoenliche-daten' THEN blk
               ELSE jsonb_set(blk, '{lines}', (
                 SELECT jsonb_agg(emitted.out_line ORDER BY l.ord, emitted.pos)
                 FROM jsonb_array_elements(blk->'lines')
                        WITH ORDINALITY AS l(line, ord)
                 CROSS JOIN LATERAL (
                   SELECT v.pos, v.out_line
                   FROM (VALUES
                     (1, CASE
                           WHEN l.line->>'id' = 'parties' THEN
                             jsonb_set(
                               jsonb_set(
                                 l.line,
                                 '{text}',
                                 '"Zwischen dem {orgName}, {orgStreet}, {orgZip} {orgCity},"'::jsonb
                               ),
                               '{fields}',
                               (l.line->'fields') || jsonb_build_array(
                                 jsonb_build_object(
                                   'id', 'parties-org-zip',
                                   'value', jsonb_build_object('kind', 'bound', 'source', 'org_zip')
                                 ),
                                 jsonb_build_object(
                                   'id', 'parties-org-city',
                                   'value', jsonb_build_object('kind', 'bound', 'source', 'org_city')
                                 )
                               )
                             )
                           WHEN l.line->>'id' = 'volunteer-name' THEN
                             jsonb_set(
                               l.line,
                               '{text}',
                               to_jsonb('und ' || (l.line->>'text'))
                             )
                           ELSE l.line
                         END),
                     (2, CASE
                           WHEN l.line->>'id' = 'parties' THEN
                             jsonb_build_object(
                               'id', 'parties-additional',
                               'text', '{additionalInfo},',
                               'optional', true,
                               'enabled', false,
                               'fields', jsonb_build_array(
                                 jsonb_build_object(
                                   'id', 'parties-additional-info',
                                   'control', 'textarea',
                                   'value', jsonb_build_object('kind', 'manual-template', 'value', '')
                                 )
                               )
                             )
                           ELSE NULL
                         END)
                   ) AS v(pos, out_line)
                   WHERE v.out_line IS NOT NULL
                 ) AS emitted
               ))
             END
             ORDER BY b.ord
           )
    FROM jsonb_array_elements(dt."body"->'blocks') WITH ORDINALITY AS b(blk, ord)
  )
)
WHERE dt."kind" = 'CONTRACT'
  AND dt."body"::text LIKE '%"Zwischen dem {orgName}, {orgStreet}, und"%'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(dt."body"->'blocks') AS blk,
         jsonb_array_elements(coalesce(blk->'lines', '[]'::jsonb)) AS line
    WHERE line->>'id' = 'parties-additional'
  );
--> statement-breakpoint

-- 2. The Einrichtung reads its own source. Where a volunteer serves can differ
--    from who signs the agreement, so overriding the organisation name must not
--    move the engagement sentence with it.
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  '{"id": "engagement-org-name", "value": {"kind": "bound", "source": "org_name"}}',
  '{"id": "engagement-org-name", "value": {"kind": "bound", "source": "org_facility_name"}}'
)::jsonb
WHERE "kind" = 'CONTRACT'
  AND "body"::text LIKE '%{"id": "engagement-org-name", "value": {"kind": "bound", "source": "org_name"}}%';