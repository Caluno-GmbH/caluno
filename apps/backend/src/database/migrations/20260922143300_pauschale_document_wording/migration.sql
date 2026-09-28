-- VOLI-1432: two wording corrections in the Pauschale document presets.
--   1. The contract's hours passage said "ca." where the document describes a
--      contractual expectation; it now reads "in der Regel".
--   2. The timesheet's allowance passage still said "Jahresdeckel". The term was
--      renamed to "Jahresfreibetrag" in the document-creation UI but never in the
--      document body, so generated Stundennachweise kept the old word.
--
-- Template bodies are per-organisation jsonb snapshots taken when a coordinator
-- first opens the builder, so correcting the preset alone leaves every existing
-- template on the old wording. This backfills them.
--
-- Only rows whose stored body still carries the exact preset text are touched,
-- so a coordinator who edited the passage keeps their version.
--
-- Scope is "document_templates" only. Issued contracts and invoices carry a
-- document number and a rendered file; they are a legal record and are never
-- rewritten. This migration does not reference those tables.
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  'Stundenzahl pro {hoursUnit}: ca. {hoursAmount}',
  'Stundenzahl pro {hoursUnit}: in der Regel {hoursAmount}'
)::jsonb
WHERE "body"::text LIKE '%Stundenzahl pro {hoursUnit}: ca. {hoursAmount}%';
--> statement-breakpoint
UPDATE "document_templates"
SET "body" = replace(
  "body"::text,
  'vom Jahresdeckel in Höhe von {yearlyLimitAmount} erhalten.',
  'vom Jahresfreibetrag in Höhe von {yearlyLimitAmount} erhalten.'
)::jsonb
WHERE "body"::text LIKE '%vom Jahresdeckel in Höhe von {yearlyLimitAmount} erhalten.%';
