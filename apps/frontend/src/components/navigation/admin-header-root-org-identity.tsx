'use client';

import { useMemo } from 'react';
import { AdminHeaderOrgIdentity } from '@/components/navigation/admin-header-org-identity';
import { usePageBreadcrumb } from '@/components/navigation/page-header-context';

/** Pins the admin header to the root org unit for organisation-wide pages. */
export function AdminHeaderRootOrgIdentity({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  const breadcrumb = useMemo(
    () => <AdminHeaderOrgIdentity name={name} logoUrl={logoUrl} />,
    [name, logoUrl],
  );
  usePageBreadcrumb(breadcrumb);
  return null;
}
