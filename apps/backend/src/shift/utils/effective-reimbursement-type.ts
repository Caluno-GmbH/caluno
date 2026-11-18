import { ReimbursementTypeKey } from '../../accounting/enums';
/**
 * The reimbursement type that actually applies to a shift occurrence: an
 * explicit per-occurrence override wins, otherwise the occurrence inherits the
 * master shift's type. `null` means the occurrence is unpaid.
 */
export function resolveEffectiveReimbursementTypeKey(
  overrideReimbursementTypeKey: ReimbursementTypeKey | null | undefined,
  masterReimbursementTypeKey: ReimbursementTypeKey | null | undefined,
): ReimbursementTypeKey | null {
  return overrideReimbursementTypeKey ?? masterReimbursementTypeKey ?? null;
}
