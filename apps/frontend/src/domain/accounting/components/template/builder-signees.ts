import {
  type CreateTemplateSigneeInput,
  PermissionKey,
  SigneeType,
} from '@repo/data';

/**
 * Signee chain for a newly created template: volunteer signs first, then a
 * permission holder (ACCOUNTING_MANAGE) countersigns.
 *
 * Callers must resolve the permission id first — never invent a volunteer-only
 * chain when the lookup is still loading or failed (that skipped the
 * coordinator step on ÜL templates).
 */
export function defaultSignees(
  accountingManagePermissionId: string,
): CreateTemplateSigneeInput[] {
  return [
    { order: 0, signeeType: SigneeType.Volunteer },
    {
      order: 1,
      signeeType: SigneeType.PermissionHolder,
      requiredPermissionId: accountingManagePermissionId,
    },
  ];
}

export function findAccountingManagePermissionId(
  permissions: ReadonlyArray<{ id: string; key: PermissionKey }> | undefined,
): string | undefined {
  return permissions?.find((p) => p.key === PermissionKey.AccountingManage)?.id;
}
