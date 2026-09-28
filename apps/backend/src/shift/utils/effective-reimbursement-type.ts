/**
 * The reimbursement type that actually applies to a shift occurrence: an
 * explicit per-occurrence override wins, otherwise the occurrence inherits the
 * master shift's type. `null` means the occurrence is unpaid.
 */
export function resolveEffectiveReimbursementTypeId(
  overrideReimbursementTypeId: string | null | undefined,
  masterReimbursementTypeId: string | null | undefined,
): string | null {
  return overrideReimbursementTypeId ?? masterReimbursementTypeId ?? null;
}
