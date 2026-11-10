'use client';

import { PermissionKey } from '@repo/data';
import { useCurrentOrg, useHasPermission } from '@repo/data/react';
import { ActionsCell, Button } from '@repo/ui';
import { Edit, Loader2, Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { DeleteAlertDialog } from '@/components/delete-alert-dialog';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { deleteRole } from '../actions';
import { canManageRoles } from '../lib/role-access';

type ActionBarProps = {
  id: string;
  isInternal: boolean;
  organizationUnitId: string;
  size?: 'xs' | 'sm' | 'md';
};

export const ActionBar = ({
  organizationUnitId,
  id,
  isInternal,
  size = 'sm',
}: ActionBarProps) => {
  const { isRoot } = useCurrentOrg();
  const hasRoleManage = useHasPermission(PermissionKey.RoleManage);
  const canManage = canManageRoles({ isRoot, hasRoleManage });
  const router = useRouter();
  const pathname = usePathname();
  const [isDeleting, startTransition] = useTransition();
  const buttonSize = `icon-${size}` as const;
  const editHref = `/admin/${organizationUnitId}/settings/roles/${id}/edit`;
  const t = useTranslations('Role.action');

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteRole({ id, organizationUnitId });
      if (result?.serverError) {
        toast.error(t('deleteError', { error: result.serverError }));
      } else {
        toast.success(t('deleteSuccess'));
        router.refresh();
        if (pathname === `/admin/${organizationUnitId}/settings/roles/${id}`) {
          router.push(`/admin/${organizationUnitId}/settings/roles`);
        }
      }
    });
  };

  return (
    <ActionsCell>
      {/* Roles are org-wide; the backend only accepts role mutations from the top unit. */}
      {!isInternal && canManage && (
        <>
          <Button
            variant="outline"
            size={buttonSize}
            tooltip={t('editAria')}
            asChild
          >
            <Link href={editHref}>
              <Edit />
            </Link>
          </Button>

          <DeleteAlertDialog
            title={t('deleteTitle')}
            description={t('deleteDescription')}
            onDelete={handleDelete}
            trigger={
              <Button
                size={buttonSize}
                variant="destructive"
                tooltip={t('deleteAria')}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="animate-spin" /> : <Trash />}
              </Button>
            }
          />
        </>
      )}
    </ActionsCell>
  );
};
