-- Timesheets are no longer auto-drafted per time entry. Those drafts each
-- claimed a single entry, which kept any document from listing more than one;
-- entries now add up per month and are claimed only when a timesheet is
-- issued. A DRAFT timesheet was never sent or signed, so removing it loses no
-- record: its claims, signature slots and status history cascade with it and
-- its time entries become available again. Draft contracts are kept.
DELETE FROM "invoices"
WHERE "invoice_status" = 'DRAFT';
