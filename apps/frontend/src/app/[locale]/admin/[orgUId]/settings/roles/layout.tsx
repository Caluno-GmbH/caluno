import type { ReactNode } from 'react';
import { AdminHeaderRootOrgIdentity } from '@/components/navigation/admin-header-root-org-identity';
import { resolveRootOrgIdentity } from '@/lib/resolve-root-org-identity';

interface Props {
  children: ReactNode;
  params: Promise<{ orgUId: string }>;
}

export default async function SettingsRolesLayout({ children, params }: Props) {
  const { orgUId } = await params;
  const root = await resolveRootOrgIdentity(orgUId);

  return (
    <>
      <AdminHeaderRootOrgIdentity name={root.name} logoUrl={root.logoUrl} />
      {children}
    </>
  );
}
