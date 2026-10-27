'use client';

import { TimeEntryStatus } from '@repo/data';
import { useQueryClient } from '@repo/data/react';
import { ActionsCell, Button } from '@repo/ui';
import { CheckCheck, Edit, Loader2, Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { DeleteAlertDialog } from '@/components/delete-alert-dialog';
import { confirmTimeEntry, deleteTimeEntry } from '@/domain/time-entry/actions';
import { Link, useRouter } from '@/i18n/navigation';

type ActionBarProps = {
  id: string;
  organizationUnitId: string;
  status: TimeEntryStatus;
  size?: 'xs' | 'sm' | 'md';
};

export const ActionBar = ({
  id,
  organizationUnitId,
  status,
  size = 'sm',
}: ActionBarProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('TimeEntry');

  const [isDeleting, startDeleteTransition] = useTransition();
  const [isConfirming, startConfirmTransition] = useTransition();

  const buttonSize = `icon-${size}` as const;

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteTimeEntry({ id, organizationUnitId });
      if (result?.serverError) {
        toast.error(t('action.deleteError', { error: result.serverError }));
      } else {
        toast.success(t('action.deleteSuccess'));
        router.push(`/admin/${organizationUnitId}/timesheets`);
      }
    });
  };

  const handleConfirm = () => {
    startConfirmTransition(async () => {
      const result = await confirmTimeEntry(id, { organizationUnitId });
      if (result?.serverError) {
        toast.error(t('action.confirmError', { error: result.serverError }));
      } else {
        toast.success(t('action.confirmSuccess'));
        // Confirmed hours become eligible for accounting; drop cached views.
        void queryClient.invalidateQueries({ queryKey: ['accounting'] });
        router.refresh();
      }
    });
  };

  return (
    <ActionsCell>
      {status === TimeEntryStatus.AutoClosed && (
        <Button
          size={buttonSize}
          variant="outline"
          tooltip={t('action.confirm')}
          disabled={isConfirming}
          onClick={handleConfirm}
        >
          {isConfirming ? <Loader2 className="animate-spin" /> : <CheckCheck />}
        </Button>
      )}
      <Link href={`/admin/${organizationUnitId}/timesheets/${id}/edit`}>
        <Button
          size={buttonSize}
          variant="outline"
          tooltip={t('action.editAria')}
        >
          <Edit />
        </Button>
      </Link>
      <DeleteAlertDialog
        title={t('action.deleteTitle')}
        description={t('action.deleteDescription')}
        onDelete={handleDelete}
        trigger={
          <Button
            size={buttonSize}
            variant="outline"
            tooltip={t('action.deleteTitle')}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="animate-spin" /> : <Trash />}
          </Button>
        }
      />
    </ActionsCell>
  );
};
