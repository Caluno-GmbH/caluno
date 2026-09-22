'use client';

import { Button } from '@repo/ui';
import { Copy, Edit, Loader2, Trash, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { DeleteAlertDialog } from '@/components/delete-alert-dialog';
import { Link, useRouter } from '@/i18n/navigation';
import { deleteShift } from '../actions';
import { shiftDuplicatePath, shiftEditPath } from '../routes';

type ActionBarProps = {
  id: string;
  organizationUnitId: string;
  size?: 'xs' | 'sm' | 'md';
  hideEdit?: boolean;
  editHref?: string;
  inviteHref?: string;
  /** After duplicating, land on the copy's detail page instead of back here (e.g. the shift's own detail view). Leave off for surfaces like the shift list, which should stay put. */
  duplicateRedirectsToDetail?: boolean;
  onDeleteSuccess?: () => void;
};

export const ActionBar = ({
  id,
  organizationUnitId,
  size = 'xs',
  hideEdit = false,
  editHref,
  inviteHref,
  duplicateRedirectsToDetail = false,
  onDeleteSuccess,
}: ActionBarProps) => {
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();
  const t = useTranslations('Shift');

  const buttonSize = `icon-${size}` as const;
  const resolvedEditHref = editHref ?? shiftEditPath(organizationUnitId, id);

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteShift({ id, organizationUnitId });
      if (result?.serverError) {
        toast.error(t('action.deleteError', { error: result.serverError }));
      } else {
        toast.success(t('action.deleteSuccess'));
        if (onDeleteSuccess) {
          onDeleteSuccess();
        } else {
          router.refresh();
        }
      }
    });
  };

  return (
    <aside className="space-x-2">
      {!hideEdit && (
        <Link href={resolvedEditHref}>
          <Button
            size={buttonSize}
            variant="outline"
            tooltip={t('action.editAria')}
          >
            <Edit />
          </Button>
        </Link>
      )}

      {inviteHref && (
        <Link href={inviteHref}>
          <Button
            size={buttonSize}
            variant="outline"
            tooltip={t('action.inviteAria')}
          >
            <UserPlus />
          </Button>
        </Link>
      )}

      <Link
        href={shiftDuplicatePath(organizationUnitId, id, {
          redirectToDetail: duplicateRedirectsToDetail,
        })}
      >
        <Button
          size={buttonSize}
          variant="outline"
          tooltip={t('action.duplicateAria')}
        >
          <Copy />
        </Button>
      </Link>

      <DeleteAlertDialog
        title={t('action.deleteTitle')}
        description={t('action.deleteDescription')}
        onDelete={handleDelete}
        trigger={
          <Button
            size={buttonSize}
            variant="destructive"
            tooltip={t('action.deleteTitle')}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash />}
          </Button>
        }
      />
    </aside>
  );
};
