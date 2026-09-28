-- Document periods are Europe/Berlin calendar days: period_start is Berlin
-- midnight of the first day and period_end Berlin midnight of the day after
-- the last day (exclusive). Rows were written three ways before: UTC month or
-- year boundaries (auto-drafted invoices, contracts), Berlin midnight of the
-- last day (the invoice dialog) and 23:59:59 UTC of the last day (older rows).
-- The columns are timestamp without time zone holding UTC.
--
-- Start: in every convention the Berlin date of the stored instant is the
-- first day. End: a stored Berlin midnight marks the last day itself (dialog);
-- any other time of day already falls on the day after the last day.
UPDATE "invoices"
SET
  "period_start" = ((("period_start" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date)::timestamp AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC',
  "period_end" = ((
    CASE
      WHEN ("period_end" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::time = time '00:00'
        THEN ("period_end" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date + 1
      ELSE ("period_end" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date
    END
  )::timestamp AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC';
--> statement-breakpoint
UPDATE "contracts"
SET
  "period_start" = ((("period_start" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date)::timestamp AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC',
  "period_end" = ((
    CASE
      WHEN ("period_end" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::time = time '00:00'
        THEN ("period_end" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date + 1
      ELSE ("period_end" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date
    END
  )::timestamp AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'UTC';
