-- VOLI-1325: the contract template preset joined the organisation name and
-- address with a single space, so the header and the parties sentence rendered
-- them as one run of text ("Riverside Community Trust 14 Millbank Road, ...").
-- Separate them: a line break in the header letterhead, a comma in the parties
-- sentence. Only rows whose stored body still carries the exact preset text are
-- touched, so coordinator-customised template bodies are left untouched.
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  'Zwischen dem {orgName} {orgAddress}, und',
  'Zwischen dem {orgName}, {orgAddress}, und'
)::jsonb
WHERE "body"::text LIKE '%Zwischen dem {orgName} {orgAddress}, und%';
--> statement-breakpoint
UPDATE "document_templates"
SET "body" = jsonb_set(
  "body",
  '{header,orgIdentityLine,text}',
  to_jsonb(
    replace(
      "body"->'header'->'orgIdentityLine'->>'text',
      '{orgName} {orgAddress}',
      E'{orgName}\n{orgAddress}'
    )
  )
)
WHERE "body"->'header'->'orgIdentityLine'->>'text' = '{orgName} {orgAddress}';
