-- Rename address → street in stored document template JSON.
--
-- The builder/renderer data sources, field ids, and placeholder tokens were
-- renamed in code (org_address/orgAddress/org-address → org_street/orgStreet/
-- org-street, and the volunteer_* equivalents). Template bodies are per-org
-- jsonb snapshots, and issued contracts/invoices freeze a copy into
-- resolved_body, so a code-only rename leaves every existing row on the old
-- keys and breaks bound-source resolution.
--
-- Already-rendered PDF files are a legal record and are not rewritten.

UPDATE "document_templates"
SET "body" = replace(
  replace(
    replace(
      replace(
        replace(
          replace("body"::text, 'org_address', 'org_street'),
          'volunteer_address',
          'volunteer_street'
        ),
        'orgAddress',
        'orgStreet'
      ),
      'volunteerAddress',
      'volunteerStreet'
    ),
    'org-address',
    'org-street'
  ),
  'volunteer-address',
  'volunteer-street'
)::jsonb
WHERE "body"::text LIKE '%org_address%'
   OR "body"::text LIKE '%volunteer_address%'
   OR "body"::text LIKE '%orgAddress%'
   OR "body"::text LIKE '%volunteerAddress%'
   OR "body"::text LIKE '%org-address%'
   OR "body"::text LIKE '%volunteer-address%';
--> statement-breakpoint

UPDATE "contracts"
SET "resolved_body" = replace(
  replace(
    replace(
      replace(
        replace(
          replace("resolved_body"::text, 'org_address', 'org_street'),
          'volunteer_address',
          'volunteer_street'
        ),
        'orgAddress',
        'orgStreet'
      ),
      'volunteerAddress',
      'volunteerStreet'
    ),
    'org-address',
    'org-street'
  ),
  'volunteer-address',
  'volunteer-street'
)::jsonb
WHERE "resolved_body"::text LIKE '%org_address%'
   OR "resolved_body"::text LIKE '%volunteer_address%'
   OR "resolved_body"::text LIKE '%orgAddress%'
   OR "resolved_body"::text LIKE '%volunteerAddress%'
   OR "resolved_body"::text LIKE '%org-address%'
   OR "resolved_body"::text LIKE '%volunteer-address%';
--> statement-breakpoint

UPDATE "invoices"
SET "resolved_body" = replace(
  replace(
    replace(
      replace(
        replace(
          replace("resolved_body"::text, 'org_address', 'org_street'),
          'volunteer_address',
          'volunteer_street'
        ),
        'orgAddress',
        'orgStreet'
      ),
      'volunteerAddress',
      'volunteerStreet'
    ),
    'org-address',
    'org-street'
  ),
  'volunteer-address',
  'volunteer-street'
)::jsonb
WHERE "resolved_body"::text LIKE '%org_address%'
   OR "resolved_body"::text LIKE '%volunteer_address%'
   OR "resolved_body"::text LIKE '%orgAddress%'
   OR "resolved_body"::text LIKE '%volunteerAddress%'
   OR "resolved_body"::text LIKE '%org-address%'
   OR "resolved_body"::text LIKE '%volunteer-address%';
