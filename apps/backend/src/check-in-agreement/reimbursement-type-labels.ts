import type { ReimbursementTypeKey } from '../accounting/enums';

// Our own copy — accounting's labels are off-limits for import.
// Record<ReimbursementTypeKey, string> makes a missing enum key a compile error.
export const PAUSCHALE_TYPE_LABELS: Record<ReimbursementTypeKey, string> = {
  EHRENAMT: 'Ehrenamtspauschale',
  UEBUNGSLEITER: 'Übungsleiterpauschale',
};

export function reimbursementTypeLabel(key: string): string {
  return PAUSCHALE_TYPE_LABELS[key as ReimbursementTypeKey] ?? key;
}
