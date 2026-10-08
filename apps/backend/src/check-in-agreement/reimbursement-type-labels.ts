import type { ReimbursementTypeKey } from '../accounting/enums';

// Local copy — accounting's labels are not exported. Record<> enforces exhaustiveness.
export const PAUSCHALE_TYPE_LABELS: Record<ReimbursementTypeKey, string> = {
  EHRENAMT: 'Ehrenamtspauschale',
  UEBUNGSLEITER: 'Übungsleiterpauschale',
};

export function reimbursementTypeLabel(key: string): string {
  return PAUSCHALE_TYPE_LABELS[key as ReimbursementTypeKey] ?? key;
}
