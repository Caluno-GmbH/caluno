-- VOLI-1351: add volunteer zip + city next to street on stored templates.
--
-- Template bodies are per-organisation jsonb snapshots. Changing the preset
-- alone leaves every existing template on street-only. This backfills them,
-- following 20260924090108_timesheet_template_catchup:
--
--   * only rows still carrying the exact preset street binding are touched;
--   * scope is "document_templates" only — issued contracts/invoices are a
--     legal record and are never rewritten.

-- 1. Contract "Persönliche Daten": extend the optional wohnhaft-in line with
--    zip + city markers and bound sources (profile keys: zip, city).
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  '"text": "wohnhaft in {volunteerStreet},", "fields": [{"id": "volunteer-street-field", "value": {"kind": "bound", "source": "volunteer_street"}}]',
  '"text": "wohnhaft in {volunteerStreet}, {volunteerZip} {volunteerCity},", "fields": [{"id": "volunteer-street-field", "value": {"kind": "bound", "source": "volunteer_street"}}, {"id": "volunteer-zip-field", "value": {"kind": "bound", "source": "volunteer_zip"}}, {"id": "volunteer-city-field", "value": {"kind": "bound", "source": "volunteer_city"}}]'
)::jsonb
WHERE "kind" = 'CONTRACT'
  AND "body"::text LIKE '%"text": "wohnhaft in {volunteerStreet},", "fields": [{"id": "volunteer-street-field"%'
  AND "body"::text NOT LIKE '%volunteer_zip%';
--> statement-breakpoint

-- 2. Invoice "Persönliche Daten": insert a zip+city line after street, before
--    IBAN — the same order as the updated invoice preset.
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  '{"id": "volunteer-street", "text": "{volunteerStreet}", "fields": [{"id": "volunteer-street-field", "value": {"kind": "bound", "source": "volunteer_street"}}], "enabled": true, "optional": false}, {"id": "volunteer-iban"',
  '{"id": "volunteer-street", "text": "{volunteerStreet}", "fields": [{"id": "volunteer-street-field", "value": {"kind": "bound", "source": "volunteer_street"}}], "enabled": true, "optional": false}, {"id": "volunteer-zip-city", "text": "{volunteerZip} {volunteerCity}", "fields": [{"id": "volunteer-zip-field", "value": {"kind": "bound", "source": "volunteer_zip"}}, {"id": "volunteer-city-field", "value": {"kind": "bound", "source": "volunteer_city"}}], "enabled": true, "optional": false}, {"id": "volunteer-iban"'
)::jsonb
WHERE "kind" = 'INVOICE'
  AND "body"::text LIKE '%"id": "volunteer-street", "text": "{volunteerStreet}"%'
  AND "body"::text LIKE '%"id": "volunteer-iban"%'
  AND "body"::text NOT LIKE '%volunteer_zip%';
