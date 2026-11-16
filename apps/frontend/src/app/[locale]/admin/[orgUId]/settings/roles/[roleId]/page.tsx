import { PermissionKey } from '@repo/data';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
} from '@repo/ui';
import { Lock, Shield, ShieldCheck, Unlock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ActionBar } from '@/domain/role/components/action-bar';
import { PermissionDetails } from '@/domain/role/components/permission-details';
import { canManageRoles } from '@/domain/role/lib/role-access';
import {
  internalRoleDescriptionKey,
  internalRoleKey,
} from '@/domain/role/lib/role-label';
import { getDataClient } from '@/lib/data-client';
import { requireOrgAccess } from '@/lib/org-context-server';
import { checkPermission } from '@/lib/permissions-server';
import { requireFound } from '@/lib/require-found';

interface RoleDetailsPageProps {
  params: Promise<{ orgUId: string; roleId: string; locale: string }>;
}

export default async function RoleDetailsPage({
  params,
}: RoleDetailsPageProps) {
  const { orgUId, roleId, locale } = await params;
  const { org } = await requireOrgAccess(orgUId);
  const [hasRoleManage] = await checkPermission(
    orgUId,
    PermissionKey.RoleManage,
  );
  const canEdit = canManageRoles({ isRoot: org.isRoot, hasRoleManage });

  const data = await getDataClient({ orgUId });
  const t = await getTranslations({ locale, namespace: 'Role' });
  const [role, permissionGroups] = await Promise.all([
    requireFound(() => data.role.findById(roleId)),
    data.role.findPermissionGroups(),
  ]);

  const rolePermissionIds = new Set(role.permissions.map((p) => p.id));
  const assignedGroups = permissionGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        rolePermissionIds.has(item.permission.id),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const roleNameKey = internalRoleKey(role);
  const roleDescriptionKey = internalRoleDescriptionKey(role);

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="page-title mb-1">
            {roleNameKey ? t(roleNameKey) : role.name}
          </h1>
          <p className="text-muted-foreground">
            {roleDescriptionKey ? t(roleDescriptionKey) : role.description}
          </p>
        </div>
        <ActionBar
          id={role.id}
          isInternal={role.isInternal}
          organizationUnitId={orgUId}
        />
      </div>

      {!canEdit && (
        <Alert>
          <Lock />
          <AlertTitle>{t('page.readOnlyTitle')}</AlertTitle>
          <AlertDescription>{t('page.readOnlyDescription')}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardContent>
              {assignedGroups.length === 0 ? (
                <p className="text-muted-foreground">
                  {t('detail.noPermissions')}
                </p>
              ) : (
                <PermissionDetails groups={assignedGroups} />
              )}
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-muted-foreground mb-2 flex gap-2 items-center">
                    <Shield className="size-4 shrink-0" />{' '}
                    {t('detail.typeLabel')}
                  </dt>
                  <dd className="ml-6">
                    {role.isInternal ? (
                      <Badge variant="neutral">
                        <Lock /> {t('detail.system')}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">
                        <Unlock /> {t('detail.custom')}
                      </Badge>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-muted-foreground mb-2 flex gap-2 items-center">
                    <ShieldCheck className="size-4 shrink-0" />
                    {t('detail.totalPermissionsLabel')}
                  </dt>
                  <dd className="ml-6">{role.permissions.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
