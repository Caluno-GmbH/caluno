import { PermissionKey } from '@repo/data';
import { getTranslations } from 'next-intl/server';
import { updateRole } from '@/domain/role/actions';
import { RoleForm } from '@/domain/role/components/role-form';
import { canManageRoles } from '@/domain/role/lib/role-access';
import { redirect } from '@/i18n/navigation';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { checkPermission } from '@/lib/permissions-server';
import { requireFound } from '@/lib/require-found';

interface TimeEntryUpdatePageProps {
  params: Promise<{ orgUId: string; roleId: string; locale: string }>;
}

export default async function RoleUpdatePage({
  params,
}: TimeEntryUpdatePageProps) {
  const { orgUId, roleId, locale } = await params;
  const { org } = await requireOrgAccess(orgUId);
  const [hasRoleManage] = await checkPermission(
    orgUId,
    PermissionKey.RoleManage,
  );
  if (!canManageRoles({ isRoot: org.isRoot, hasRoleManage })) {
    redirect({ href: `/admin/${orgUId}/settings/roles`, locale });
  }

  const data = await getDataClient({ orgUId });
  const t = await getTranslations({ locale, namespace: 'Role.sheet' });

  const [role, permissionGroups] = await Promise.all([
    requireFound(() => data.role.findById(roleId)),
    data.role.findPermissionGroups(),
  ]);

  return (
    <RoleForm
      mode="edit"
      title={t('editTitle')}
      description={t('editDescription')}
      organizationUnitId={orgUId}
      permissionGroups={permissionGroups}
      mutate={updateRole.bind(null, role.id)}
      initialValues={{
        organizationUnitId: orgUId,
        name: role.name,
        description: role.description ?? undefined,
        permissionIds: role.permissions.map((p) => p.id),
      }}
    />
  );
}
