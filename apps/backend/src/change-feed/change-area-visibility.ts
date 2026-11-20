import { PermissionKey } from '../auth/enums';
import { ChangeArea } from './enums';

/**
 * Which permission a caller must hold on the header unit (or any of its
 * ancestors) before the change feed reveals that area's unit-scoped rows.
 *
 * User-scoped rows (`user_id = caller`) are always visible regardless of this
 * map — a volunteer can see their own changes without any unit permission.
 */
export const UNIT_AREA_PERMISSIONS: Record<ChangeArea, PermissionKey[]> = {
  [ChangeArea.CONTRACTS]: [PermissionKey.ACCOUNTING_MANAGE],
  [ChangeArea.INVOICES]: [PermissionKey.ACCOUNTING_MANAGE],
  [ChangeArea.MEMBERSHIP_REQUESTS]: [PermissionKey.VOLUNTEER_VIEW],
};
