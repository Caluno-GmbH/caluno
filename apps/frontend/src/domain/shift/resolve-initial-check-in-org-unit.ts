/**
 * Picks the org unit the check-in page opens on.
 *
 * Every unit the admin holds `check-in:manage` in is selectable — the
 * volunteer's memberships are not an eligibility filter, only a preference,
 * because a non-member is a blocker the page resolves rather than hides.
 * Preference order: the managed query param, a unit with a pending membership
 * request (the admin most likely has something to approve there), a unit the
 * volunteer belongs to, then the first unit.
 */
export function resolveInitialCheckInOrgUnit(options: {
  orgUnitIds: string[];
  memberOrgUnitIds: string[];
  pendingOrgUnitIds: string[];
  orgUIdParam?: string | undefined;
}): string | null {
  const { orgUnitIds, memberOrgUnitIds, pendingOrgUnitIds, orgUIdParam } =
    options;

  if (orgUIdParam && orgUnitIds.includes(orgUIdParam)) {
    return orgUIdParam;
  }

  const pendingIds = new Set(pendingOrgUnitIds);
  const memberIds = new Set(memberOrgUnitIds);
  return (
    orgUnitIds.find((id) => pendingIds.has(id)) ??
    orgUnitIds.find((id) => memberIds.has(id)) ??
    orgUnitIds[0] ??
    null
  );
}
