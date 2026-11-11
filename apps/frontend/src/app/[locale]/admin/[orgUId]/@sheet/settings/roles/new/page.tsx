import { PermissionKey } from '@repo/data';
import { getTranslations } from 'next-intl/server';
import { createRole } from '@/domain/role/actions';
import { RoleForm } from '@/domain/role/components/role-form';
import { canManageRoles } from '@/domain/role/lib/role-access';
import { redirect } from '@/i18n/navigation';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { checkPermission } from '@/lib/permissions-server';

interface CreateRolePageProps {
  params: Promise<{ orgUId: string; locale: string }>;
}

export default async function CreateRolePage({ params }: CreateRolePageProps) {
  const { orgUId, locale } = await params;
  const { org } = await requireOrgAccess(orgUId);
  const [hasRoleManage] = await checkPermission(
    orgUId,
    PermissionKey.RoleManage,
  );
  if (!canManageRoles({ isRoot: org.isRoot, hasRoleManage })) {
    redirect({ href: `/admin/${orgUId}/settings/roles`, locale });
  }

  const dataClient = await getDataClient({ orgUId });
  const permissionGroups = await dataClient.role.findPermissionGroups();
  const t = await getTranslations({ locale, namespace: 'Role.sheet' });

  return (
    <RoleForm
      mode="create"
      title={t('createTitle')}
      description={t('createDescription')}
      organizationUnitId={orgUId}
      permissionGroups={permissionGroups}
      mutate={createRole}
    />
  );
}
