-- Timesheets are no longer auto-drafted per time entry. Those drafts each
-- claimed a single entry, which kept any document from listing more than one;
-- entries now add up per month and are claimed only when a timesheet is
-- issued. A DRAFT timesheet was never sent or signed, so removing it loses no
-- record: its claims, signature slots and status history cascade with it and
-- its time entries become available again. Draft contracts are kept.
--
-- Guard the delete: an untouched draft has no rendered file and has not been
-- declined or paid. If any draft is not in that state, abort instead of
-- silently dropping a document that may matter. Log the count either way.
DO $$
DECLARE
  draft_count integer;
  unsafe_count integer;
BEGIN
  SELECT count(*) INTO draft_count
  FROM "invoices"
  WHERE "invoice_status" = 'DRAFT';

  SELECT count(*) INTO unsafe_count
  FROM "invoices"
  WHERE "invoice_status" = 'DRAFT'
    AND (
      "file_id" IS NOT NULL
      OR "declined_at" IS NOT NULL
      OR "paid_at" IS NOT NULL
    );

  IF unsafe_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to delete % DRAFT invoice(s) that have a file, a decline or a payment; expected only untouched auto-drafts',
      unsafe_count;
  END IF;

  RAISE NOTICE 'Removing % untouched auto-drafted timesheet(s)', draft_count;
END $$;

DELETE FROM "invoices"
WHERE "invoice_status" = 'DRAFT';
