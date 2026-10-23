'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Checkbox,
  Label,
} from '@repo/ui';
import { Loader2, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type ReactNode,
  useEffect,
  useId,
  useState,
  useTransition,
} from 'react';
import { getFormDeleteImpact } from '../actions';

type DeleteImpact = {
  submissionCount: number;
  attachments: Array<{
    targetType: string;
    targetId: string;
    name: string;
  }>;
};

export function DeleteFormDialog({
  formId,
  formName,
  organizationUnitId,
  onDelete,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  formId: string;
  formName: string;
  organizationUnitId: string;
  onDelete: () => Promise<void>;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('RequirementForm.deleteDialog');
  const tCommon = useTranslations('Common');
  const ackId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;

  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loadingImpact, startLoadImpact] = useTransition();
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    if (!open) {
      setImpact(null);
      setLoadError(false);
      setAcknowledged(false);
      return;
    }

    startLoadImpact(async () => {
      setLoadError(false);
      const result = await getFormDeleteImpact({
        organizationUnitId,
        formId,
      });
      if (result?.data) {
        setImpact(result.data);
      } else {
        setLoadError(true);
      }
    });
  }, [open, formId, organizationUnitId]);

  function handleConfirm() {
    if (!acknowledged || deleting) return;
    startDelete(async () => {
      await onDelete();
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">
            {t('title', { name: formName })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm">
            {t('intro')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 text-sm">
          {loadingImpact && (
            <p className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {t('loading')}
            </p>
          )}
          {loadError && <p className="text-destructive">{t('loadError')}</p>}
          {impact && (
            <>
              <p>{t('submissionCount', { count: impact.submissionCount })}</p>
              <p className="text-destructive font-medium">
                {t('answersDeleted')}
              </p>
              {impact.attachments.length > 0 ? (
                <div className="space-y-1">
                  <p>{t('attachmentsIntro')}</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {impact.attachments.map((attachment) => (
                      <li
                        key={`${attachment.targetType}-${attachment.targetId}`}
                      >
                        {t('attachmentItem', {
                          type: t(`targetType.${attachment.targetType}`),
                          name: attachment.name,
                        })}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground">
                    {t('attachmentsDetach')}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">{t('noAttachments')}</p>
              )}
            </>
          )}

          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id={ackId}
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              disabled={!impact || loadingImpact || deleting}
            />
            <Label htmlFor={ackId} className="font-normal leading-snug">
              {t('acknowledge')}
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} className="h-10">
            <X />
            {tCommon('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
            disabled={!acknowledged || !impact || deleting || loadingImpact}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10"
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {deleting ? t('deleting') : tCommon('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
