import type { Database } from '../../database/database.module';

/** Org details a document renders and the accounting gates require. */
export const INHERITED_ORG_PROFILE_COLUMNS = [
  'address',
  'zipCode',
  'city',
  'legalRep',
] as const;

type InheritedColumn = (typeof INHERITED_ORG_PROFILE_COLUMNS)[number];

export type ResolvedOrgProfile = {
  id: string;
  name: string;
} & Record<InheritedColumn, string | null>;

export type UnitRow = {
  id: string;
  parentId?: string | null;
  name: string;
  deletedAt?: Date | null;
} & Partial<Record<InheritedColumn, string | null>>;

const isBlank = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '';

/**
 * Pure resolution of a unit's org details from the unit plus its already-loaded
 * ancestors: the unit's own values, with any blank field taken from its nearest
 * live ancestor that has it. A soft-deleted unit is never inherited from (its
 * details are stale), but the chain still walks through it so a live
 * grandparent can still contribute.
 *
 * Split out from `resolveOrgProfile` so a batched DataLoader can hand it units
 * it loaded in bulk instead of querying per ancestor hop.
 */
export function resolveOrgProfileFromUnits(
  unit: UnitRow,
  unitsById: Map<string, UnitRow>,
): ResolvedOrgProfile {
  const profile: ResolvedOrgProfile = {
    id: unit.id,
    name: unit.name,
    address: null,
    zipCode: null,
    city: null,
    legalRep: null,
  };
  const fillFrom = (row: UnitRow) => {
    for (const column of INHERITED_ORG_PROFILE_COLUMNS) {
      if (isBlank(profile[column]) && !isBlank(row[column])) {
        profile[column] = row[column] ?? null;
      }
    }
  };
  const complete = () =>
    INHERITED_ORG_PROFILE_COLUMNS.every((column) => !isBlank(profile[column]));

  if (!unit.deletedAt) fillFrom(unit);
  let current = unit;
  const visited = new Set([unit.id]);
  while (!complete() && current.parentId && !visited.has(current.parentId)) {
    const parent = unitsById.get(current.parentId);
    if (!parent) break;
    visited.add(parent.id);
    if (!parent.deletedAt) fillFrom(parent);
    current = parent;
  }

  return profile;
}

/**
 * The org details for a unit (or the org root when no unit is given): the
 * unit's own values, with any blank field taken from its nearest ancestor that
 * has it. A sub-org belongs to the same legal organization, so it doesn't need
 * its own copy of the address or legal representative to create documents.
 *
 * Used by every place that checks or renders org details (the create gates,
 * the setup status, the PDF) so they can't disagree.
 */
export async function resolveOrgProfile(
  db: Database,
  organizationId: string,
  organizationUnitId: string | null | undefined,
): Promise<ResolvedOrgProfile | undefined> {
  const unit = (await db.query.organizationUnits.findFirst({
    where: organizationUnitId
      ? { id: organizationUnitId }
      : { organizationId, parentId: { isNull: true } },
  })) as UnitRow | undefined;
  if (!unit) return undefined;

  const unitsById = new Map<string, UnitRow>([[unit.id, unit]]);
  let current = unit;
  const visited = new Set([unit.id]);
  while (current.parentId && !visited.has(current.parentId)) {
    const parent = (await db.query.organizationUnits.findFirst({
      where: { id: current.parentId },
    })) as UnitRow | undefined;
    if (!parent) break;
    visited.add(parent.id);
    unitsById.set(parent.id, parent);
    current = parent;
  }

  return resolveOrgProfileFromUnits(unit, unitsById);
}
