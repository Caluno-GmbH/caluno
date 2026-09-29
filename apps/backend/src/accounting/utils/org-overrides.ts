/**
 * Twin of `applyOrgOverrides` in
 * `packages/data/src/repositories/accounting/template-body.types.ts`, which the
 * builder and the creation previews use. The backend does not depend on
 * `@repo/data`, so the rule lives in both — the same arrangement
 * `letterheadLines` already has. Change one, change the other.
 */

export type OrgOverrideSource =
  | 'org_name'
  | 'org_facility_name'
  | 'org_street'
  | 'org_zip'
  | 'org_city';

export const ORG_OVERRIDE_SOURCES: readonly OrgOverrideSource[] = [
  'org_name',
  'org_facility_name',
  'org_street',
  'org_zip',
  'org_city',
];

export type OrgOverrides = Partial<Record<OrgOverrideSource, string>>;

/**
 * The org values a document renders, with any coordinator override applied.
 *
 * Blank overrides are ignored, so clearing the field in the builder falls back
 * to the organisation's own value rather than printing nothing — which is how a
 * coordinator undoes an override. `org_facility_name` falls back to the
 * organisation's name, since most agreements are signed by the body the
 * volunteer actually serves at.
 */
export function applyOrgOverrides<T extends Record<string, string>>(
  values: T,
  overrides: OrgOverrides | undefined,
): T & { org_facility_name: string } {
  const resolved: Record<string, string> = {
    ...values,
    org_facility_name: values.org_facility_name ?? values.org_name ?? '',
  };
  for (const source of ORG_OVERRIDE_SOURCES) {
    const override = overrides?.[source]?.trim();
    if (override) resolved[source] = override;
  }
  return resolved as T & { org_facility_name: string };
}
