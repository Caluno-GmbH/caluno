import type { Database } from '../../database/database.module';

/** Org details a document renders and the accounting gates require. */
export const INHERITED_ORG_PROFILE_COLUMNS = [
  'address',
  'city',
  'zipCode',
  'legalRep',
] as const;

type InheritedColumn = (typeof INHERITED_ORG_PROFILE_COLUMNS)[number];

export type ResolvedOrgProfile = {
  id: string;
  name: string;
} & Record<InheritedColumn, string | null>;

type UnitRow = {
  id: string;
  parentId?: string | null;
  name: string;
} & Partial<Record<InheritedColumn, string | null>>;

const isBlank = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '';

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

  const profile: ResolvedOrgProfile = {
    id: unit.id,
    name: unit.name,
    address: null,
    city: null,
    zipCode: null,
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

  fillFrom(unit);
  let current = unit;
  const visited = new Set([unit.id]);
  while (!complete() && current.parentId && !visited.has(current.parentId)) {
    const parent = (await db.query.organizationUnits.findFirst({
      where: { id: current.parentId },
    })) as UnitRow | undefined;
    if (!parent) break;
    visited.add(parent.id);
    fillFrom(parent);
    current = parent;
  }

  return profile;
}
