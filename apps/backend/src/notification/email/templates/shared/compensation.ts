import { ReimbursementTypeKey } from '../../../../accounting/enums';
import type { EmailTranslate } from '../../../../i18n/email-translate';

/**
 * Volunteer-facing Pauschalentyp label for invitation emails. Returns null for
 * an unpaid shift (no key) so the compensation row is omitted entirely — there
 * is no "unpaid" state.
 */
export function emailCompensationLabel(
  key: ReimbursementTypeKey | null | undefined,
  t: EmailTranslate,
): string | null {
  switch (key) {
    case ReimbursementTypeKey.EHRENAMT:
      return t('compensation.ehrenamt');
    case ReimbursementTypeKey.UEBUNGSLEITER:
      return t('compensation.uebungsleiter');
    default:
      return null;
  }
}
