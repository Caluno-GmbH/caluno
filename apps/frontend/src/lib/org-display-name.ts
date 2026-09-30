/** Minimal shape needed to render an org unit's switcher label. */
export interface OrgUnitDisplayNameParts {
  name: string;
  isRoot: boolean;
  rootOrganizationName: string | undefined;
}

/** Root units show the org name; nested units show "RootOrg › Unit". */
export function getOrgUnitDisplayName(org: OrgUnitDisplayNameParts): string {
  return org.isRoot || !org.rootOrganizationName
    ? org.name
    : `${org.rootOrganizationName} › ${org.name}`;
}
