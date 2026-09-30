/**
 * The first column of one Stundennachweis row. Only `shift_name` varies from
 * row to row; the other two repeat the same value down the table.
 *
 * A row with no shift behind it falls back to the agreement's task description
 * — the volunteer agreed to do that work whether or not a shift was planned
 * for it — and then to whatever they typed when they tracked the time, rather
 * than leaving the cell blank.
 */
export function resolveFirstColumn(args: {
  source: string;
  customLabel: string | undefined;
  shiftName: string | undefined;
  agreementTaskDescription: string | undefined;
  notes: string | undefined;
}): string {
  switch (args.source) {
    case 'custom':
      return args.customLabel?.trim() || '';
    case 'agreement_task_description':
      return args.agreementTaskDescription?.trim() || args.notes?.trim() || '';
    default:
      return (
        args.shiftName?.trim() ||
        args.agreementTaskDescription?.trim() ||
        args.notes?.trim() ||
        ''
      );
  }
}
