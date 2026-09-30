import { appDateParts } from '../../shift/utils/app-time';

/**
 * The document number a timesheet carries. Two of the four formats state the
 * cost centre inside the number itself, which is why the template forces that
 * field on once one of them is chosen.
 *
 * `sequence` counts documents within one sub-organisation and one calendar
 * year, restarting at 1 each January as an organisation's books do. Every
 * format carries the year, so a restarted counter still cannot produce the same
 * number twice. It is allocated when the invoice is created and stored on it —
 * an issued document keeps the number it was issued under, whatever happens to
 * the template afterwards.
 */
export function formatInvoiceNumber(args: {
  invoiceFormat: string | null | undefined;
  periodStart: Date;
  kostenstelle: string | undefined;
  sequence: number;
}): string {
  const { year, month, day } = appDateParts(args.periodStart);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const kostenstelle = args.kostenstelle?.trim() || '—';
  const seq = String(args.sequence).padStart(3, '0');

  switch (args.invoiceFormat) {
    case 'date-kostenstelle-number':
      return `${year}${mm}${dd}-${kostenstelle}-${seq}`;
    case 'compact-date-number':
      return `${String(year).slice(2)}${mm}${dd}${seq}`;
    case 'kostenstelle-month-year-number':
      return `${kostenstelle}-${mm}.${year}-${seq}`;
    default:
      return `${year}${mm}${dd}-${seq}`;
  }
}
