import { cache } from 'react';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { requireFound } from '@/lib/require-found';

/** Root org-unit name + logo for organisation-wide admin surfaces. */
export const resolveRootOrgIdentity = cache(async (orgUId: string) => {
  const { org, organizations } = await requireOrgAccess(orgUId);

  if (org.isRoot) {
    return { name: org.name, logoUrl: org.logoUrl };
  }

  const rootFromList = organizations.find(
    (unit) => unit.organizationId === org.organizationId && unit.isRoot,
  );
  if (rootFromList) {
    return { name: rootFromList.name, logoUrl: rootFromList.logoUrl };
  }

  const data = await getDataClient({ orgUId });
  const root = await requireFound(() =>
    data.organization.findRootUnit(org.organizationId),
  );
  const rootUnit = await requireFound(() =>
    data.organizationUnit.findById(root.id),
  );

  return {
    name: rootUnit.name,
    logoUrl: rootUnit.logoUrl ?? org.logoUrl,
  };
});
